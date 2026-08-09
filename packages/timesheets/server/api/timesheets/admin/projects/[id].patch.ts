import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateProject } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { projectUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminProjectsByIdPatch',
    summary: 'Update a timesheet project',
    description: 'Update a timesheet project. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  return updateProject(
    organizationId,
    getRouterParam(event, 'id')!,
    projectUpdateSchema.parse(await readBody(event))
  )
})
