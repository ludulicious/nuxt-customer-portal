import { getPortalOrganization, requireSession } from '@nuxt-customer-portal/core/server/portal'
import { updateOrganizationTimesheetCapabilities } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { organizationCapabilitiesUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'System administrator access required' })
  }
  const organizationId = getRouterParam(event, 'organizationId')!
  const input = organizationCapabilitiesUpdateSchema.parse(await readBody(event))
  const organization = await getPortalOrganization(organizationId)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }
  if (organization.organizationType !== 'PROVIDER' && input.workspaceEnabled) {
    throw createError({
      statusCode: 400,
      message: 'Timesheets workspaces can only be enabled for provider organizations'
    })
  }
  return updateOrganizationTimesheetCapabilities(organizationId, input)
})
