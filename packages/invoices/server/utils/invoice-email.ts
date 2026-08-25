import { createHash } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@nuxt-customer-portal/core/server/portal'
import {
  getPortalEmailProviderStatus,
  renderPortalEmail,
  sendPortalEmail
} from '@nuxt-customer-portal/core/server/utils/portal-email'
import {
  invoice,
  invoiceAttachment,
  invoiceEmailDelivery,
  invoiceHistory
} from '@nuxt-customer-portal/invoices/server/db/schema/invoices'
import type { InvoiceEmailPreviewDto, InvoiceEmailPurpose } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { generateInvoicePdf } from './invoice-pdf'
import { getInvoice, getOrganizationInvoiceProfile } from './invoice-repository'

export const MAX_EMAIL_ATTACHMENT_SIZE = 40 * 1024 * 1024
const domainFor = (email: string) => email.split('@')[1]?.toLowerCase() ?? ''
const emailDefinition = (purpose: InvoiceEmailPurpose) => {
  const id = purpose === 'REMINDER' ? 'payment-reminder' : 'invoice'
  const definition = invoicesFeature.emails?.find((item) => item.id === id)
  if (!definition) {
    throw new Error(`Missing invoice email definition: ${id}`)
  }
  return definition
}
const htmlToPlainText = (value: string) =>
  value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()

export const getInvoiceEmailPreview = async (
  organizationId: string,
  id: string,
  localeOverride?: string,
  purpose: InvoiceEmailPurpose = 'INVOICE'
): Promise<InvoiceEmailPreviewDto> => {
  const [selected, sender, files, providerStatus] = await Promise.all([
    getInvoice(organizationId, id),
    getOrganizationInvoiceProfile(organizationId),
    db.select().from(invoiceAttachment).where(eq(invoiceAttachment.invoiceId, id)),
    getPortalEmailProviderStatus()
  ])
  if (!sender.invoiceEmail) {
    throw createError({ statusCode: 409, message: 'Configure the company invoice email first' })
  }
  if (purpose === 'REMINDER' && !selected.isOverdue) {
    throw createError({ statusCode: 409, message: 'Only overdue invoices can receive payment reminders' })
  }
  const locale = localeOverride === 'en' ? 'en' : selected.recipientLocale === 'en' ? 'en' : 'nl'
  const pdf = await generateInvoicePdf(selected, locale)
  const pdfName = `${locale === 'nl' ? 'factuur' : 'invoice'}-${selected.number.replace(/[^a-z0-9._-]+/gi, '-')}.pdf`
  const senderDomain = domainFor(sender.invoiceEmail)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${selected.dueDate}T12:00:00Z`)
  )
  const outstanding = new Intl.NumberFormat(locale, { style: 'currency', currency: selected.currency }).format(
    selected.outstandingMinor / 100
  )
  const values = {
    invoice_number: selected.number,
    sender_name: selected.senderName,
    recipient_name: selected.recipientName,
    due_date: date,
    outstanding_amount: outstanding
  }
  const rendered = await renderPortalEmail({
    moduleId: invoicesFeature.id,
    definition: emailDefinition(purpose),
    locale,
    values
  })
  return {
    to: selected.recipientEmail ?? '',
    cc: [],
    locale,
    subject: rendered.subject,
    body: htmlToPlainText(rendered.body),
    senderEmail: sender.invoiceEmail,
    senderDomain,
    emailProviderConfigured: providerStatus.configured,
    senderDomainVerified: providerStatus.verifiedDomains.includes(senderDomain),
    attachments: [
      { fileName: pdfName, size: pdf.length },
      ...files.map((file) => ({ fileName: file.fileName, size: file.size }))
    ],
    totalAttachmentSize: pdf.length + files.reduce((sum, file) => sum + file.size, 0),
    maximumAttachmentSize: MAX_EMAIL_ATTACHMENT_SIZE
  }
}

export const deliverInvoiceEmail = async (
  organizationId: string,
  actorUserId: string,
  id: string,
  input: { to: string; cc: string[]; locale: 'nl' | 'en'; subject: string; body: string },
  issue: boolean,
  purpose: InvoiceEmailPurpose = 'INVOICE'
) => {
  const selected = await getInvoice(organizationId, id)
  if (purpose === 'REMINDER' && !selected.isOverdue) {
    throw createError({ statusCode: 409, message: 'Only overdue invoices can receive payment reminders' })
  }
  if (issue ? selected.status !== 'DRAFT' : !['ISSUED', 'PAID'].includes(selected.status)) {
    throw createError({
      statusCode: 409,
      message: issue ? 'Only draft invoices can be issued' : 'Only issued invoices can be resent'
    })
  }
  const preview = await getInvoiceEmailPreview(organizationId, id, input.locale, purpose)
  if (!preview.emailProviderConfigured) {
    throw createError({ statusCode: 409, message: 'The organization email provider is not configured' })
  }
  if (!preview.senderDomainVerified) {
    throw createError({ statusCode: 409, message: `The sending domain ${preview.senderDomain} is not verified` })
  }
  if (preview.totalAttachmentSize > MAX_EMAIL_ATTACHMENT_SIZE) {
    throw createError({
      statusCode: 413,
      message: `Email attachments exceed 40 MB: ${preview.attachments.map((file) => file.fileName).join(', ')}`
    })
  }
  const payloadHash = createHash('sha256').update(JSON.stringify({ purpose, input })).digest('hex')
  const currentInvoice = await getInvoice(organizationId, id)
  if (purpose === 'REMINDER' && !currentInvoice.isOverdue) {
    throw createError({ statusCode: 409, message: 'Only overdue invoices can receive payment reminders' })
  }
  const [pending] = await db
    .select()
    .from(invoiceEmailDelivery)
    .where(and(eq(invoiceEmailDelivery.invoiceId, id), eq(invoiceEmailDelivery.status, 'PENDING')))
    .orderBy(desc(invoiceEmailDelivery.createdAt))
    .limit(1)
  if (pending && pending.payloadHash !== payloadHash) {
    throw createError({ statusCode: 409, message: 'A different email delivery is already pending' })
  }
  const delivery =
    pending ??
    (
      await db
        .insert(invoiceEmailDelivery)
        .values({
          id: nanoid(),
          invoiceId: id,
          actorUserId,
          purpose,
          status: 'PENDING',
          recipientEmail: input.to,
          ccEmails: JSON.stringify(input.cc),
          locale: input.locale,
          subject: input.subject,
          body: input.body,
          payloadHash
        })
        .returning()
    )[0]!
  const pdf = await generateInvoicePdf(currentInvoice, input.locale)
  const storedFiles = await db.select().from(invoiceAttachment).where(eq(invoiceAttachment.invoiceId, id))
  let result: { id: string }
  try {
    const locale = input.locale
    const dueDate = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(`${currentInvoice.dueDate}T12:00:00Z`)
    )
    const outstandingAmount = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currentInvoice.currency
    }).format(currentInvoice.outstandingMinor / 100)
    result = await sendPortalEmail({
      moduleId: invoicesFeature.id,
      definition: emailDefinition(purpose),
      locale,
      values: {
        invoice_number: currentInvoice.number,
        sender_name: currentInvoice.senderName,
        recipient_name: currentInvoice.recipientName,
        due_date: dueDate,
        outstanding_amount: outstandingAmount
      },
      fromEmail: preview.senderEmail,
      fromName: currentInvoice.senderName,
      to: input.to,
      cc: input.cc,
      text: { subject: input.subject, body: input.body.replaceAll('\n', '<br>') },
      attachments: [
        { filename: preview.attachments[0]!.fileName, content: Buffer.from(pdf), contentType: 'application/pdf' },
        ...storedFiles.map((file) => ({
          filename: file.fileName,
          content: Buffer.from(file.contentBase64, 'base64'),
          contentType: file.contentType
        }))
      ],
      idempotencyKey: delivery.id
    })
  } catch (error) {
    await db
      .update(invoiceEmailDelivery)
      .set({
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
      .where(eq(invoiceEmailDelivery.id, delivery.id))
    throw createError({ statusCode: 502, message: 'The invoice email could not be sent', cause: error })
  }
  await db.transaction(async (tx) => {
    const finalized = await tx
      .update(invoiceEmailDelivery)
      .set({ status: 'SENT', providerMessageId: result.id, sentAt: new Date(), errorMessage: null })
      .where(and(eq(invoiceEmailDelivery.id, delivery.id), eq(invoiceEmailDelivery.status, 'PENDING')))
      .returning({ id: invoiceEmailDelivery.id })
    if (!finalized.length) {
      return
    }
    if (issue) {
      await tx
        .update(invoice)
        .set({ status: 'ISSUED', issuedAt: new Date() })
        .where(and(eq(invoice.id, id), eq(invoice.status, 'DRAFT')))
      await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'ISSUED', actorUserId })
    }
    await tx.insert(invoiceHistory).values({
      id: nanoid(),
      invoiceId: id,
      action: purpose === 'REMINDER' ? 'REMINDER_SENT' : 'EMAIL_SENT',
      actorUserId,
      attachmentName: input.to
    })
  })
  return { deliveryId: delivery.id, status: 'SENT' as const, providerMessageId: result.id, to: input.to, cc: input.cc }
}
