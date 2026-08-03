import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { getInvoiceEmailPreview } from '#layers/timesheets/server/utils/invoice-email'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdReminderPreviewGet',
    summary: 'Preview an invoice reminder',
    description: 'Preview an invoice reminder. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const locale = getQuery(event).locale
  return getInvoiceEmailPreview(organizationId, getRouterParam(event, 'id')!, typeof locale === 'string' ? locale : undefined, 'REMINDER')
})
