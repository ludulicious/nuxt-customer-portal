import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { clientListQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'
import { listClientsPage } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-admin-listing'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminClientsGet',
    summary: 'List timesheet clients',
    description: 'List timesheet clients. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return listClientsPage(organizationId, clientListQuerySchema.parse(getQuery(event)))
})
