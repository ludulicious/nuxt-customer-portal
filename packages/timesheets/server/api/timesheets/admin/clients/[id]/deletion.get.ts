import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { getClientDeletionEligibility } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminClientsByIdDeletionGet',
    summary: 'Check client deletion eligibility',
    description:
      'Check client deletion eligibility. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return getClientDeletionEligibility(organizationId, getRouterParam(event, 'id')!)
})
