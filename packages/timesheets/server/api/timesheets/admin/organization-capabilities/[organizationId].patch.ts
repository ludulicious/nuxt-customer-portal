import { requireSession } from '@nuxt-customer-portal/core/server/portal'
import { updateOrganizationTimesheetCapabilities } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { organizationCapabilitiesUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') throw createError({ statusCode: 403, message: 'System administrator access required' })
  return updateOrganizationTimesheetCapabilities(getRouterParam(event, 'organizationId')!, organizationCapabilitiesUpdateSchema.parse(await readBody(event)))
})
