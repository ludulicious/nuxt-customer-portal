import { createHash } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '#portal/server/portal'
import { EmailProviderRejectedError, getOrganizationEmailCredentialStatus, sendOrganizationEmail } from '~~/server/utils/organization-email-provider'
import { invoice, invoiceAttachment, invoiceEmailDelivery, invoiceHistory } from '#layers/timesheets/server/db/schema/timesheets'
import type { InvoiceEmailPreviewDto, InvoiceEmailPurpose } from '#layers/timesheets/shared/types/timesheet'
import { generateInvoicePdf } from './invoice-pdf'
import { getInvoice, getOrganizationInvoiceProfile } from './timesheet-repository'

export const MAX_EMAIL_ATTACHMENT_SIZE = 40 * 1024 * 1024
const copy = {
  nl: {
    subject: (number: string, sender: string) => `Factuur ${number} van ${sender}`,
    body: (number: string) => `Geachte heer/mevrouw,\n\nIn de bijlage vindt u factuur ${number}.\n\nMet vriendelijke groet,`,
    reminderSubject: (number: string, sender: string) => `Betalingsherinnering factuur ${number} van ${sender}`,
    reminderBody: (number: string, dueDate: string, outstanding: string) => `Geachte heer/mevrouw,\n\nVolgens onze administratie staat factuur ${number}, met vervaldatum ${dueDate}, nog open voor ${outstanding}. Wij verzoeken u vriendelijk het openstaande bedrag te voldoen.\n\nHeeft u inmiddels betaald? Dan kunt u deze herinnering als niet verzonden beschouwen.\n\nMet vriendelijke groet,`
  },
  en: {
    subject: (number: string, sender: string) => `Invoice ${number} from ${sender}`,
    body: (number: string) => `Dear Sir or Madam,\n\nPlease find invoice ${number} attached.\n\nKind regards,`,
    reminderSubject: (number: string, sender: string) => `Payment reminder for invoice ${number} from ${sender}`,
    reminderBody: (number: string, dueDate: string, outstanding: string) => `Dear Sir or Madam,\n\nAccording to our records, invoice ${number}, due on ${dueDate}, remains outstanding for ${outstanding}. We kindly ask you to arrange payment of the outstanding amount.\n\nIf your payment has crossed with this message, please disregard this reminder.\n\nKind regards,`
  }
} as const
const domainFor = (email: string) => email.split('@')[1]?.toLowerCase() ?? ''
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\u0022', '&quot;').replaceAll('\u0027', '&#039;')

export const getInvoiceEmailPreview = async (organizationId: string, id: string, localeOverride?: string, purpose: InvoiceEmailPurpose = 'INVOICE'): Promise<InvoiceEmailPreviewDto> => {
  const [selected, sender, files, providerStatus] = await Promise.all([
    getInvoice(organizationId, id), getOrganizationInvoiceProfile(organizationId),
    db.select().from(invoiceAttachment).where(eq(invoiceAttachment.invoiceId, id)), getOrganizationEmailCredentialStatus(organizationId)
  ])
  if (!sender.invoiceEmail) throw createError({ statusCode: 409, message: 'Configure the company invoice email first' })
  if (purpose === 'REMINDER' && !selected.isOverdue) throw createError({ statusCode: 409, message: 'Only overdue invoices can receive payment reminders' })
  const locale = localeOverride === 'en' ? 'en' : selected.recipientLocale === 'en' ? 'en' : 'nl'
  const pdf = await generateInvoicePdf(selected, locale)
  const pdfName = `${locale === 'nl' ? 'factuur' : 'invoice'}-${selected.number.replace(/[^a-z0-9._-]+/gi, '-')}.pdf`
  const senderDomain = domainFor(sender.invoiceEmail)
  const localeCopy = copy[locale]
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${selected.dueDate}T12:00:00Z`))
  const outstanding = new Intl.NumberFormat(locale, { style: 'currency', currency: selected.currency }).format(selected.outstandingMinor / 100)
  return {
    to: selected.recipientEmail ?? '', cc: [], locale,
    subject: purpose === 'REMINDER' ? localeCopy.reminderSubject(selected.number, selected.senderName) : localeCopy.subject(selected.number, selected.senderName),
    body: `${purpose === 'REMINDER' ? localeCopy.reminderBody(selected.number, date, outstanding) : localeCopy.body(selected.number)}\n${selected.senderName}`,
    senderEmail: sender.invoiceEmail, senderDomain, emailProviderConfigured: providerStatus.configured,
    senderDomainVerified: providerStatus.verifiedDomains.includes(senderDomain),
    attachments: [{ fileName: pdfName, size: pdf.length }, ...files.map(file => ({ fileName: file.fileName, size: file.size }))],
    totalAttachmentSize: pdf.length + files.reduce((sum, file) => sum + file.size, 0), maximumAttachmentSize: MAX_EMAIL_ATTACHMENT_SIZE
  }
}

export const deliverInvoiceEmail = async (organizationId: string, actorUserId: string, id: string, input: { to: string, cc: string[], locale: 'nl' | 'en', subject: string, body: string }, issue: boolean, purpose: InvoiceEmailPurpose = 'INVOICE') => {
  const selected = await getInvoice(organizationId, id)
  if (purpose === 'REMINDER' && !selected.isOverdue) throw createError({ statusCode: 409, message: 'Only overdue invoices can receive payment reminders' })
  if (issue ? selected.status !== 'DRAFT' : !['ISSUED', 'PAID'].includes(selected.status)) throw createError({ statusCode: 409, message: issue ? 'Only draft invoices can be issued' : 'Only issued invoices can be resent' })
  const preview = await getInvoiceEmailPreview(organizationId, id, input.locale, purpose)
  if (!preview.emailProviderConfigured) throw createError({ statusCode: 409, message: 'The organization email provider is not configured' })
  if (!preview.senderDomainVerified) throw createError({ statusCode: 409, message: `The sending domain ${preview.senderDomain} is not verified` })
  if (preview.totalAttachmentSize > MAX_EMAIL_ATTACHMENT_SIZE) throw createError({ statusCode: 413, message: `Email attachments exceed 40 MB: ${preview.attachments.map(file => file.fileName).join(', ')}` })
  const payloadHash = createHash('sha256').update(JSON.stringify({ purpose, input })).digest('hex')
  const currentInvoice = await getInvoice(organizationId, id)
  if (purpose === 'REMINDER' && !currentInvoice.isOverdue) throw createError({ statusCode: 409, message: 'Only overdue invoices can receive payment reminders' })
  const [pending] = await db.select().from(invoiceEmailDelivery).where(and(eq(invoiceEmailDelivery.invoiceId, id), eq(invoiceEmailDelivery.status, 'PENDING'))).orderBy(desc(invoiceEmailDelivery.createdAt)).limit(1)
  if (pending && pending.payloadHash !== payloadHash) throw createError({ statusCode: 409, message: 'A different email delivery is already pending' })
  const delivery = pending ?? (await db.insert(invoiceEmailDelivery).values({ id: nanoid(), invoiceId: id, actorUserId, purpose, status: 'PENDING', recipientEmail: input.to, ccEmails: JSON.stringify(input.cc), locale: input.locale, subject: input.subject, body: input.body, payloadHash }).returning())[0]!
  const pdf = await generateInvoicePdf(currentInvoice, input.locale)
  const storedFiles = await db.select().from(invoiceAttachment).where(eq(invoiceAttachment.invoiceId, id))
  let result: { id: string }
  try {
    result = await sendOrganizationEmail(organizationId, {
      from: `${currentInvoice.senderName.replace(/[<>\r\n]/g, '')} <${preview.senderEmail}>`, to: input.to, cc: input.cc,
      subject: input.subject, text: input.body, html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(input.body)}</div>`,
      attachments: [{ filename: preview.attachments[0]!.fileName, content: Buffer.from(pdf), contentType: 'application/pdf' }, ...storedFiles.map(file => ({ filename: file.fileName, content: Buffer.from(file.contentBase64, 'base64'), contentType: file.contentType }))],
      idempotencyKey: delivery.id
    })
  } catch (error) {
    await db.update(invoiceEmailDelivery).set({
      status: error instanceof EmailProviderRejectedError ? 'FAILED' : 'PENDING',
      errorMessage: error instanceof Error ? error.message : String(error)
    }).where(eq(invoiceEmailDelivery.id, delivery.id))
    throw createError({ statusCode: 502, message: 'The invoice email could not be sent', cause: error })
  }
  await db.transaction(async (tx) => {
    const finalized = await tx.update(invoiceEmailDelivery).set({ status: 'SENT', providerMessageId: result.id, sentAt: new Date(), errorMessage: null })
      .where(and(eq(invoiceEmailDelivery.id, delivery.id), eq(invoiceEmailDelivery.status, 'PENDING'))).returning({ id: invoiceEmailDelivery.id })
    if (!finalized.length) return
    if (issue) {
      await tx.update(invoice).set({ status: 'ISSUED', issuedAt: new Date() }).where(and(eq(invoice.id, id), eq(invoice.status, 'DRAFT')))
      await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'ISSUED', actorUserId })
    }
    await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: purpose === 'REMINDER' ? 'REMINDER_SENT' : 'EMAIL_SENT', actorUserId, attachmentName: input.to })
  })
  return { deliveryId: delivery.id, status: 'SENT' as const, providerMessageId: result.id, to: input.to, cc: input.cc }
}
