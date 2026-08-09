import { requireSession } from '@nuxt-customer-portal/core/server/portal'
import { getOrganizationTimesheetCapabilities } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') throw createError({ statusCode: 403, message: 'System administrator access required' })
  return getOrganizationTimesheetCapabilities(getRouterParam(event, 'organizationId')!)
})
