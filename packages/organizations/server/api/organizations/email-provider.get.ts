import { requireOrganizationOwnerOrSystemAdmin } from '@nuxt-customer-portal/core/server/portal'
import { getOrganizationEmailCredentialStatus } from '@nuxt-customer-portal/core/server/utils/organization-email-provider'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalOrganizationsEmailProviderGet',
    summary: 'Get organization email credentials',
    description:
      'Get organization email credentials. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestedOrganizationId = typeof query.organizationId === 'string' ? query.organizationId : undefined
  const { organizationId } = await requireOrganizationOwnerOrSystemAdmin(event, requestedOrganizationId)
  return getOrganizationEmailCredentialStatus(organizationId, getQuery(event).refresh === '1')
})
