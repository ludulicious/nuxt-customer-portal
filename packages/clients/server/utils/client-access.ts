import type { H3Event } from 'h3'
import { isPersonalClient } from '@nuxt-customer-portal/core/server/utils/client-account-policy'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'

export const requireOwnerClientManager = async (event: H3Event) => {
  const context = await requireActiveOrganizationRole(event)
  if (context.organizationType !== 'PROVIDER' || !['owner', 'admin'].includes(context.role ?? '')) {
    throw createError({ statusCode: 403, message: 'PROVIDER organization administrator access required' })
  }
  return context
}

export const requireClientProfileManager = async (event: H3Event, clientOrganizationId: string) => {
  const context = await requireActiveOrganizationRole(event)
  const providerManager = context.organizationType === 'PROVIDER' && ['owner', 'admin'].includes(context.role ?? '')
  const clientManager =
    context.organizationType === 'CLIENT' &&
    context.organizationId === clientOrganizationId &&
    ['owner', 'admin'].includes(context.role ?? '')
  if (!providerManager && !clientManager) {
    throw createError({ statusCode: 403, message: 'Client administrator access required' })
  }
  return context
}

export const requireClientMemberManager = async (event: H3Event, id: string) => {
  const context = await requireClientProfileManager(event, id)
  if (context.organizationType !== 'PROVIDER' && (await isPersonalClient(id))) {
    throw createError({ statusCode: 403, message: 'Personal accounts cannot manage members or invitations' })
  }
  return context
}
