import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import {
  getBootstrap,
  requireTimesheetWorkspace
} from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { weekQuerySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsBootstrapGet',
    summary: 'Get timesheets workspace data',
    description:
      'Get timesheets workspace data. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'read')
  const query = weekQuerySchema.parse(getQuery(event))
  await requireTimesheetWorkspace(organizationId)
  return getBootstrap(organizationId, session.user.id, query.week)
})
