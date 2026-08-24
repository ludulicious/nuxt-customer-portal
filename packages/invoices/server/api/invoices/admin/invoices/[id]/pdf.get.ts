import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { generateInvoicePdf } from '@nuxt-customer-portal/invoices/server/utils/invoice-pdf'
import { getInvoice } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdPdfGet',
    summary: 'Download an invoice PDF',
    description: 'Download an invoice PDF. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const invoice = await getInvoice(organizationId, getRouterParam(event, 'id')!)
  const locale = getQuery(event).locale
  const disposition = getQuery(event).download === '1' ? 'attachment' : 'inline'
  const pdf = await generateInvoicePdf(invoice, typeof locale === 'string' ? locale : undefined)
  const fileName = `invoice-${invoice.number.replace(/[^a-z0-9._-]+/gi, '-')}.pdf`

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${disposition}; filename="${fileName}"`,
    'Cache-Control': 'private, no-store'
  })
  return Buffer.from(pdf)
})
