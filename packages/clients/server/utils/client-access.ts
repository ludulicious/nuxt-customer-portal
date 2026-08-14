import type { H3Event } from 'h3'
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
  const clientManager = context.organizationType === 'CLIENT'
    && context.organizationId === clientOrganizationId
    && ['owner', 'admin'].includes(context.role ?? '')
  if (!providerManager && !clientManager) throw createError({ statusCode: 403, message: 'Client administrator access required' })
  return context
}
