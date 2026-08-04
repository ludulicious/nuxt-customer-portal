import { requireSession } from '#portal/server/portal'
import { updateOrganizationTimesheetCapabilities } from '#layers/timesheets/server/utils/timesheet-repository'
import { organizationCapabilitiesUpdateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') throw createError({ statusCode: 403, message: 'System administrator access required' })
  return updateOrganizationTimesheetCapabilities(getRouterParam(event, 'organizationId')!, organizationCapabilitiesUpdateSchema.parse(await readBody(event)))
})
