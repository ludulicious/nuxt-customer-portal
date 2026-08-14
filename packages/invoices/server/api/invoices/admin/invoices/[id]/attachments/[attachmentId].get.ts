import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getInvoiceAttachment } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesByIdAttachmentsByAttachmentIdGet',
    summary: 'Download an invoice attachment',
    description: 'Download an invoice attachment. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const attachment = await getInvoiceAttachment(organizationId, getRouterParam(event, 'id')!, getRouterParam(event, 'attachmentId')!)
  setResponseHeader(event, 'content-type', attachment.contentType)
  setResponseHeader(event, 'content-length', attachment.size)
  setResponseHeader(event, 'content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
  return Buffer.from(attachment.contentBase64, 'base64')
})
