import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { createProject } from '#layers/timesheets/server/utils/timesheet-repository'
import { projectCreateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminProjectsPost',
    summary: 'Create a timesheet project',
    description: 'Create a timesheet project. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  return createProject(organizationId, projectCreateSchema.parse(await readBody(event)))
})
