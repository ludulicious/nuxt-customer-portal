import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { createError } from 'h3'
import { currencyScale } from '../../shared/money'
import { firstInvoiceNumber, incrementInvoiceNumber } from '../../shared/invoice-number'
import { getOrganizationInvoiceProfile, requireInvoicesEnabled } from './invoice-repository'

export interface CommerceDocument {
  reference: string
  storeId: string
  clientId: string
  actorId: string
  title: string
  currency: string
  net: number
  tax: number
  total: number
  taxDetails: unknown
  recipientName: string
  address: string
  email: string
  locale: 'en' | 'nl'
  paymentReference: string
  originalInvoiceId?: string
}
export async function assertCommerceInvoicesReady(storeId: string) {
  await requireInvoicesEnabled(storeId)
  const sender = await getOrganizationInvoiceProfile(storeId)
  if (!sender.address || !sender.registrationNumber || !sender.vatNumber || !sender.invoiceEmail) {
    throw createError({
      statusCode: 409,
      message: 'Complete the invoice sender address, registration, VAT number and email first'
    })
  }
}
/** Exact checkout totals are authoritative; never reconstruct tax from a rounded percentage. */
export async function createCommerceDocument(tx: PoolClient, input: CommerceDocument) {
  if (input.net + input.tax !== input.total) {
    throw new Error('Invoice amounts do not reconcile')
  }
  const existing = await tx.query<{ id: string }>(
    'SELECT id FROM invoices.invoice WHERE organization_id=$1 AND external_reference=$2',
    [input.storeId, input.reference]
  )
  if (existing.rows[0]) {
    return existing.rows[0].id
  }
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice-number:${input.storeId}`])
  const sender = await getOrganizationInvoiceProfile(input.storeId)
  const numbers = await tx.query<{ number: string }>(
    'SELECT number FROM invoices.invoice WHERE organization_id=$1 ORDER BY created_at DESC',
    [input.storeId]
  )
  const used = new Set(numbers.rows.map((r) => r.number)),
    latest = numbers.rows.find((r) => /\d+$/.test(r.number))
  let number = latest ? incrementInvoiceNumber(latest.number) : firstInvoiceNumber()
  while (used.has(number)) {
    number = incrementInvoiceNumber(number)
  }
  const breakdown = input.taxDetails as {
    taxes?: Array<{ amount: number; rate?: { display_name?: string; percentage?: number }; taxability_reason?: string }>
    taxIds?: Array<{ value?: string }>
    taxExempt?: string
  } | null
  const notes = [
    input.locale === 'nl' ? 'Automatisch verwerkt via Stripe.' : 'Automatically reconciled through Stripe.',
    input.paymentReference
  ]
  if (input.originalInvoiceId) {
    const original = await tx.query<{ number: string }>(
      'SELECT number FROM invoices.invoice WHERE id=$1 AND organization_id=$2 AND currency=$3',
      [input.originalInvoiceId, input.storeId, input.currency]
    )
    if (!original.rows[0]) {
      throw new Error('Original invoice does not match this credit')
    }
    notes.push(`${input.locale === 'nl' ? 'Credit op factuur' : 'Credit against invoice'} ${original.rows[0].number}`)
  } else {
    for (const tax of breakdown?.taxes ?? []) {
      notes.push(
        `${tax.rate?.display_name || (input.locale === 'nl' ? 'Belasting' : 'Tax')} (${tax.rate?.percentage ?? 0}%): ${new Intl.NumberFormat(input.locale, { style: 'currency', currency: input.currency }).format(tax.amount / currencyScale(input.currency))}`
      )
    }
  }
  for (const taxId of breakdown?.taxIds ?? []) {
    if (taxId.value) {
      notes.push(`${input.locale === 'nl' ? 'Btw-nummer klant' : 'Customer tax ID'}: ${taxId.value}`)
    }
  }
  if (
    breakdown?.taxExempt === 'reverse' ||
    breakdown?.taxes?.some((tax) => tax.taxability_reason === 'reverse_charge')
  ) {
    notes.push(input.locale === 'nl' ? 'Btw verlegd' : 'Reverse charge')
  }
  const id = randomUUID(),
    today = new Date().toISOString().slice(0, 10)
  await tx.query(
    `INSERT INTO invoices.invoice(id,organization_id,client_organization_id,number,status,currency,issue_date,due_date,subject,notes,sender_name,sender_logo,sender_address,sender_registration,sender_vat_number,sender_iban,sender_bic,recipient_name,recipient_address,recipient_email,recipient_locale,created_by_id,issued_at,document_type,original_invoice_id,external_reference,automated)
 VALUES($1,$2,$3,$4,'PAID',$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,now(),$21,$22,$23,true)`,
    [
      id,
      input.storeId,
      input.clientId,
      number,
      input.currency,
      today,
      input.title,
      notes.join('\n'),
      sender.name,
      sender.logo,
      sender.address,
      sender.registrationNumber,
      sender.vatNumber,
      sender.iban,
      sender.bic,
      input.recipientName,
      input.address,
      input.email,
      input.locale,
      input.actorId,
      input.originalInvoiceId ? 'credit' : 'invoice',
      input.originalInvoiceId || null,
      input.reference
    ]
  )
  await tx.query(
    "INSERT INTO invoices.invoice_line(id,invoice_id,position,description,quantity_milli,unit,unit_price_minor,vat_rate_basis_points,exact_tax_minor,tax_details) VALUES($1,$2,0,$3,1000,'item',$4,$5,$6,$7)",
    [
      randomUUID(),
      id,
      input.title,
      input.net,
      input.net ? Math.round((input.tax / input.net) * 10000) : 0,
      input.tax,
      JSON.stringify(input.taxDetails)
    ]
  )
  await tx.query(
    'INSERT INTO invoices.invoice_payment(id,invoice_id,paid_on,amount_minor,reference,note,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      randomUUID(),
      id,
      today,
      input.total,
      input.paymentReference,
      'Automatically reconciled provider transaction',
      input.actorId
    ]
  )
  for (const action of ['CREATED', 'ISSUED', 'PAYMENT_REGISTERED']) {
    await tx.query(
      'INSERT INTO invoices.invoice_history(id,invoice_id,action,actor_user_id,amount_minor) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), id, action, input.actorId, input.total]
    )
  }
  await tx.query(
    `INSERT INTO invoices.client_access(id,provider_organization_id,client_organization_id,enabled) VALUES($1,$2,$3,true) ON CONFLICT(provider_organization_id,client_organization_id) DO NOTHING`,
    [randomUUID(), input.storeId, input.clientId]
  )
  return id
}
