import { and, eq, gt } from 'drizzle-orm'
import { createError } from 'h3'
import { invitationChangeSchema } from '../../shared/invitation-validation'
import { db } from './db'
import { invitation } from '../db/schema/auth-schema'

export const changePendingInvitation = async (organizationId: string, invitationId: string, body: unknown) => {
  const parsed = invitationChangeSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid invitation change' })
  }
  const change = parsed.data
  const [updated] = await db
    .update(invitation)
    .set(change)
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, 'pending'),
        'role' in change ? gt(invitation.expiresAt, new Date()) : undefined
      )
    )
    .returning({ id: invitation.id })
  if (!updated) {
    throw createError({ statusCode: 409, message: 'Invitation is no longer pending or available' })
  }
  return { success: true }
}
