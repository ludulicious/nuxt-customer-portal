import { getPortalOrganization, requireSession } from '@nuxt-customer-portal/core/server/portal'
import { getOrganizationTimesheetCapabilities } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'System administrator access required' })
  }
  const organizationId = getRouterParam(event, 'organizationId')!
  const organization = await getPortalOrganization(organizationId)
  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }
  const capabilities = await getOrganizationTimesheetCapabilities(organizationId)
  return {
    ...capabilities,
    workspaceEnabled: organization.organizationType === 'PROVIDER' && capabilities.workspaceEnabled
  }
})
