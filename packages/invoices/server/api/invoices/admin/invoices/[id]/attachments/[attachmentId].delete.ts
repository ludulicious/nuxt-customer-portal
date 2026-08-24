import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { deleteInvoiceAttachment } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdAttachmentsByAttachmentIdDelete',
    summary: 'Delete an invoice attachment',
    description:
      'Delete an invoice attachment. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return deleteInvoiceAttachment(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    getRouterParam(event, 'attachmentId')!
  )
})
