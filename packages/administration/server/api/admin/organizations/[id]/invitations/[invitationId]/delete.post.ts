import { defineEventHandler, createError, getRouterParam } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { invitation as invitationTable, member as memberTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { eq, and } from 'drizzle-orm'
import type { SessionUser } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminOrganizationsByIdInvitationsByInvitationIdDeletePost',
    summary: 'Cancel an organization invitation',
    description: 'Cancel an organization invitation. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const user = session.user as SessionUser
  const organizationId = getRouterParam(event, 'id')
  const invitationId = getRouterParam(event, 'invitationId')

  if (!organizationId || !invitationId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Invitation ID are required' })
  }

  // Check if user is admin - admins have full access
  if (user.role !== 'admin') {
    // For non-admin users, check if they are a member and have invitation.cancel permission
    const [member] = await db
      .select()
      .from(memberTable)
      .where(
        and(
          eq(memberTable.userId, user.id),
          eq(memberTable.organizationId, organizationId)
        )
      )
      .limit(1)

    if (!member) {
      throw createError({ statusCode: 403, message: 'Access denied. You must be an admin or a member of this organization with invitation permissions.' })
    }

    // Only owners and admins have invitation.cancel permission
    // Members don't have invitation permissions, so they can't delete invitations
    if (member.role !== 'owner' && member.role !== 'admin') {
      throw createError({ statusCode: 403, message: 'Access denied. Only organization owners and admins can delete invitations.' })
    }
  }

  // Get invitation to verify it exists and belongs to the organization
  const [invitation] = await db
    .select()
    .from(invitationTable)
    .where(eq(invitationTable.id, invitationId))
    .limit(1)

  if (!invitation || invitation.organizationId !== organizationId) {
    throw createError({ statusCode: 404, message: 'Invitation not found' })
  }

  // Delete the invitation directly from database
  await db
    .delete(invitationTable)
    .where(eq(invitationTable.id, invitationId))

  return { success: true, message: 'Invitation cancelled successfully' }
})
