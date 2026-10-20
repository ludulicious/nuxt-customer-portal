import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import { splitInclusiveTax } from './deferred-tax'

export async function reviewDeferredInvoiceTax(
  organizationId: string,
  actorId: string,
  id: string,
  rates: Array<{ lineId: string; vatRateBasisPoints: number }>
) {
  const tx = await pool.connect()
  try {
    await tx.query('BEGIN')
    const {
      rows: [invoice]
    } = await tx.query('SELECT * FROM invoices.invoice WHERE id=$1 AND organization_id=$2 FOR UPDATE', [
      id,
      organizationId
    ])
    if (!invoice || invoice.status !== 'DRAFT' || invoice.agreed_total_minor === null) {
      throw createError({ statusCode: 409, message: 'Only deferred invoice drafts can be reviewed' })
    }
    const { rows: lines } = await tx.query(
      'SELECT * FROM invoices.invoice_line WHERE invoice_id=$1 ORDER BY position',
      [id]
    )
    if (
      rates.length !== lines.length ||
      new Set(rates.map((rate) => rate.lineId)).size !== lines.length ||
      lines.some((line) => !rates.some((rate) => rate.lineId === line.id))
    ) {
      throw createError({ statusCode: 400, message: 'Review every invoice line exactly once' })
    }
    let total = 0
    for (const line of lines) {
      const gross =
        Math.round((line.quantity_milli * line.unit_price_minor) / 1000) +
        (line.exact_tax_minor ??
          Math.round((((line.quantity_milli * line.unit_price_minor) / 1000) * line.vat_rate_basis_points) / 10000))
      const rate = rates.find((rate) => rate.lineId === line.id)!.vatRateBasisPoints
      const split = splitInclusiveTax(gross, rate)
      const unitNet = Math.round((split.net * 1000) / line.quantity_milli)
      if (Math.round((line.quantity_milli * unitNet) / 1000) !== split.net) {
        throw createError({ statusCode: 409, message: 'Invoice quantity cannot represent the agreed total exactly' })
      }
      total += gross
      await tx.query(
        'UPDATE invoices.invoice_line SET unit_price_minor=$2,vat_rate_basis_points=$3,exact_tax_minor=$4,tax_details=$5 WHERE id=$1',
        [line.id, unitNet, rate, split.tax, JSON.stringify({ reviewed: true, inclusiveTotal: gross })]
      )
    }
    if (total !== invoice.agreed_total_minor) {
      throw createError({ statusCode: 409, message: 'Invoice total must match the agreed purchase total' })
    }
    await tx.query('UPDATE invoices.invoice SET tax_review_required=false WHERE id=$1', [id])
    await tx.query('INSERT INTO invoices.invoice_history(id,invoice_id,action,actor_user_id) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      id,
      'TAX_REVIEWED',
      actorId
    ])
    await tx.query('COMMIT')
    return { reviewed: true }
  } catch (error) {
    await tx.query('ROLLBACK')
    throw error
  } finally {
    tx.release()
  }
}
