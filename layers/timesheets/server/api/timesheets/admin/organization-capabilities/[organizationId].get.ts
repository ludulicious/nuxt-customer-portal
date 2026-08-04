import { requireSession } from '#portal/server/portal'
import { getOrganizationTimesheetCapabilities } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') throw createError({ statusCode: 403, message: 'System administrator access required' })
  return getOrganizationTimesheetCapabilities(getRouterParam(event, 'organizationId')!)
})
