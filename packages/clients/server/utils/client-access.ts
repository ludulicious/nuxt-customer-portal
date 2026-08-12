import type { H3Event } from 'h3'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'

export const requireOwnerClientManager = async (event: H3Event) => {
  const context = await requireActiveOrganizationRole(event)
  if (context.organizationType !== 'OWNER' || !['owner', 'admin'].includes(context.role ?? '')) {
    throw createError({ statusCode: 403, message: 'OWNER organization administrator access required' })
  }
  return context
}

export const requireClientProfileManager = async (event: H3Event, clientOrganizationId: string) => {
  const context = await requireActiveOrganizationRole(event)
  const ownerManager = context.organizationType === 'OWNER' && ['owner', 'admin'].includes(context.role ?? '')
  const clientManager = context.organizationType === 'CLIENT'
    && context.organizationId === clientOrganizationId
    && ['owner', 'admin'].includes(context.role ?? '')
  if (!ownerManager && !clientManager) throw createError({ statusCode: 403, message: 'Client administrator access required' })
  return context
}
