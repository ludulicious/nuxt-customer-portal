import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { projectListQuerySchema } from '#layers/timesheets/server/utils/timesheet-validation'
import { listProjectsPage } from '#layers/timesheets/server/utils/timesheet-admin-listing'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminProjectsGet',
    summary: 'List timesheet projects',
    description: 'List timesheet projects. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return listProjectsPage(organizationId, projectListQuerySchema.parse(getQuery(event)))
})
