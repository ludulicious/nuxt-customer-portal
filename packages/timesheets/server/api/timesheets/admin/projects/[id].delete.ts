import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { deleteProject } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { projectDeleteSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminProjectsByIdDelete',
    summary: 'Delete a timesheet project',
    description:
      'Delete a timesheet project. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const input = projectDeleteSchema.parse(await readBody(event))
  return deleteProject(organizationId, getRouterParam(event, 'id')!, input.projectName)
})
