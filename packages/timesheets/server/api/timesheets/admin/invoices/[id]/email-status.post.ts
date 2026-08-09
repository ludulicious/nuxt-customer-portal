import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { refreshInvoiceEmailStatuses } from '@nuxt-customer-portal/timesheets/server/utils/invoice-email-status'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdEmailStatusPost',
    summary: 'Refresh invoice email delivery status',
    description: 'Refresh invoice email delivery status. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return refreshInvoiceEmailStatuses(
    organizationId,
    getRouterParam(event, 'id')!,
    getQuery(event).refresh === '1'
  )
})
