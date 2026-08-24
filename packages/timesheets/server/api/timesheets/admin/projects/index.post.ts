import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { createProject } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { projectCreateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminProjectsPost',
    summary: 'Create a timesheet project',
    description:
      'Create a timesheet project. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return createProject(organizationId, projectCreateSchema.parse(await readBody(event)))
})
