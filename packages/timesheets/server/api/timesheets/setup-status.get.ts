import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { getTimesheetsSetupStatus, requireTimesheetWorkspace } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsSetupStatusGet',
    summary: 'Get Timesheets setup readiness',
    description: 'Get the active organization’s Timesheets setup checklist. Requires Timesheets management access.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  await requireTimesheetWorkspace(organizationId)
  return getTimesheetsSetupStatus(organizationId)
})
