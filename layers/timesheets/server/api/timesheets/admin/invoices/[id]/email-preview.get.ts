import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { getInvoiceEmailPreview } from '#layers/timesheets/server/utils/invoice-email'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdEmailPreviewGet',
    summary: 'Preview an invoice email',
    description: 'Preview an invoice email. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const locale = getQuery(event).locale
  return getInvoiceEmailPreview(organizationId, getRouterParam(event, 'id')!, typeof locale === 'string' ? locale : undefined)
})
