import { defineEventHandler, createError, readBody } from 'h3'
import { z } from 'zod'
import { auth, generateId } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import {
  invitation as invitationTable,
  member as memberTable,
  organization as organizationTable
} from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { eq, and } from 'drizzle-orm'
import type { SessionUser } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalOrganizationsAcceptInvitationPost',
    summary: 'Accept an organization invitation',
    description:
      'Accept an organization invitation. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

/**
 * Custom endpoint to accept invitations, bypassing Better Auth's inviter membership check.
 * This is necessary because admins who create organizations and invite owners
 * are removed as members, but their invitations should still be valid.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const user = session.user as SessionUser
  const parsed = z.object({ invitationId: z.string().min(1) }).safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invitation ID is required' })
  }
  const { invitationId } = parsed.data

  try {
    return await db.transaction(async (tx) => {
      // Fetch the invitation
      const [invitation] = await tx
        .select()
        .from(invitationTable)
        .where(eq(invitationTable.id, invitationId))
        .limit(1)
        .for('update')

      if (!invitation) {
        throw createError({ statusCode: 404, message: 'Invitation not found' })
      }

      // Validate that the invitation is still pending
      if (invitation.status !== 'pending') {
        throw createError({ statusCode: 400, message: 'Invitation is no longer valid' })
      }

      // Validate that the invitation hasn't expired
      const now = new Date()
      const expiresAt = new Date(invitation.expiresAt)
      if (expiresAt < now) {
        throw createError({ statusCode: 400, message: 'Invitation has expired' })
      }

      // Validate that the user's email matches the invitation email
      if (user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
        throw createError({
          statusCode: 400,
          message: 'Email mismatch: This invitation was sent to a different email address'
        })
      }

      // Check if user is already a member
      const [existingMember] = await tx
        .select()
        .from(memberTable)
        .where(and(eq(memberTable.organizationId, invitation.organizationId), eq(memberTable.userId, user.id)))
        .limit(1)

      if (existingMember) {
        throw createError({ statusCode: 400, message: 'You are already a member of this organization' })
      }

      // Get organization details
      const [organization] = await tx
        .select()
        .from(organizationTable)
        .where(eq(organizationTable.id, invitation.organizationId))
        .limit(1)

      if (!organization) {
        throw createError({ statusCode: 404, message: 'Organization not found' })
      }

      // Create the member record
      const memberId = generateId()
      await tx.insert(memberTable).values({
        id: memberId,
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role || 'member',
        createdAt: new Date()
      })

      // Update invitation status to accepted
      await tx.update(invitationTable).set({ status: 'accepted' }).where(eq(invitationTable.id, invitationId))

      return {
        success: true,
        member: {
          id: memberId,
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role || 'member'
        },
        organization: {
          id: organization.id,
          name: organization.name
        }
      }
    })
  } catch (err: unknown) {
    if (err instanceof Error && 'statusCode' in err) {
      throw err
    }
    const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation'
    throw createError({ statusCode: 500, message: errorMessage })
  }
})
