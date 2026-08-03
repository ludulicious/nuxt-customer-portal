import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { clientListQuerySchema } from '#layers/timesheets/server/utils/timesheet-validation'
import { listClientsPage } from '#layers/timesheets/server/utils/timesheet-admin-listing'

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
