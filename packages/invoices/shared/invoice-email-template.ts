export const DEFAULT_INVOICE_EMAIL_TEMPLATE =
  '<div style="font-family:Arial,sans-serif;white-space:pre-line">{{body}}</div>'

export interface InvoiceEmailTemplateValues {
  body: string
  subject: string
  invoiceNumber: string
  senderName: string
  recipientName: string
  logoUrl: string
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\u0022', '&quot;')
    .replaceAll('\u0027', '&#039;')

export const renderInvoiceEmailTemplate = (template: string | null | undefined, values: InvoiceEmailTemplateValues) => {
  const replacements = {
    body: escapeHtml(values.body),
    subject: escapeHtml(values.subject),
    invoice_number: escapeHtml(values.invoiceNumber),
    sender_name: escapeHtml(values.senderName),
    recipient_name: escapeHtml(values.recipientName),
    logo_url: escapeHtml(values.logoUrl)
  }
  return Object.entries(replacements).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
    template?.trim() || DEFAULT_INVOICE_EMAIL_TEMPLATE
  )
}
