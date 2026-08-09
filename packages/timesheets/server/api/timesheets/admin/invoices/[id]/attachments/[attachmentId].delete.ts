import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { deleteInvoiceAttachment } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdAttachmentsByAttachmentIdDelete',
    summary: 'Delete an invoice attachment',
    description: 'Delete an invoice attachment. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return deleteInvoiceAttachment(organizationId, session.user.id, getRouterParam(event, 'id')!, getRouterParam(event, 'attachmentId')!)
})
