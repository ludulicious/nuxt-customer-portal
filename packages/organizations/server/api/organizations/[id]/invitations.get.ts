import { defineEventHandler, createError, getRouterParam } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { invitation as invitationTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { eq, and } from 'drizzle-orm'
import { checkOrganizationPermission } from '@nuxt-customer-portal/core/server/utils/permissions'
import type { OrganizationInvitationsResponse } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalOrganizationsByIdInvitationsGet',
    summary: 'List organization invitations',
    description: 'List organization invitations. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event): Promise<OrganizationInvitationsResponse> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'Organization ID is required' })
  }

  // Check if user has permission to list members (which includes viewing invitations)
  const hasPermission = await checkOrganizationPermission(
    session as { user: { id: string, role?: string } },
    organizationId,
    'member',
    'list'
  )

  if (!hasPermission) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  // Get all invitations for this organization
  const invitations = await db
    .select()
    .from(invitationTable)
    .where(
      and(
        eq(invitationTable.organizationId, organizationId),
        eq(invitationTable.status, 'pending')
      )
    )

  return invitations as OrganizationInvitationsResponse
})
