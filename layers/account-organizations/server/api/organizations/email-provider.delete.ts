import { requireOrganizationOwnerOrSystemAdmin } from '#portal/server/portal'
import { removeOrganizationEmailCredential } from '#portal/server/utils/organization-email-provider'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalOrganizationsEmailProviderDelete',
    summary: 'Remove organization email credentials',
    description: 'Remove organization email credentials. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestedOrganizationId = typeof query.organizationId === 'string' ? query.organizationId : undefined
  const { organizationId, session } = await requireOrganizationOwnerOrSystemAdmin(event, requestedOrganizationId)
  await removeOrganizationEmailCredential(organizationId, session.user.id)
  return { configured: false }
})
