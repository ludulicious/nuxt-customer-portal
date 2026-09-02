import { defineEventHandler, createError, getRouterParam } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { checkOrganizationPermission } from '@nuxt-customer-portal/core/server/utils/permissions'
import { changePendingInvitation } from '@nuxt-customer-portal/core/server/utils/invitation-management'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalOrganizationsByIdInvitationsByInvitationIdDeletePost',
    summary: 'Cancel an organization invitation',
    description:
      'Cancel an organization invitation. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const organizationId = getRouterParam(event, 'id')
  const invitationId = getRouterParam(event, 'invitationId')

  if (!organizationId || !invitationId) {
    throw createError({ statusCode: 400, message: 'Organization ID and Invitation ID are required' })
  }

  // Check if user has permission to cancel invitations
  const hasPermission = await checkOrganizationPermission(
    session as { user: { id: string; role?: string } },
    organizationId,
    'invitation',
    'cancel'
  )

  if (!hasPermission) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  return changePendingInvitation(organizationId, invitationId, { status: 'canceled' })
})
