import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { addInvoiceAttachment } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesByIdAttachmentsPost',
    summary: 'Upload an invoice attachment',
    description: 'Upload an invoice attachment. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename)
  if (!file?.filename) throw createError({ statusCode: 400, message: 'Select a file to attach' })
  return addInvoiceAttachment(organizationId, session.user.id, getRouterParam(event, 'id')!, {
    fileName: file.filename,
    contentType: file.type || 'application/octet-stream',
    data: file.data
  })
})
