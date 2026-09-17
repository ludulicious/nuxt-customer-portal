import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { auth, generateId } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import {
  assertClientInvitationAcceptance,
  getClientAccountIdentity,
  isPersonalClient
} from '@nuxt-customer-portal/core/server/utils/client-account-policy'
import {
  invitation as invitationTable,
  member as memberTable,
  organization as organizationTable,
  user as userTable
} from '@nuxt-customer-portal/core/server/db/schema/auth-schema'

const bodySchema = z.object({
  invitationId: z.string().min(1),
  email: z.email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid signup details' })
  }

  const input = parsed.data
  const email = input.email.trim().toLowerCase()
  const [invitation] = await db
    .select()
    .from(invitationTable)
    .where(eq(invitationTable.id, input.invitationId))
    .limit(1)

  if (!invitation) {
    throw createError({ statusCode: 400, message: 'Invitation is no longer valid' })
  }
  if (invitation.email.trim().toLowerCase() !== email) {
    throw createError({ statusCode: 400, message: 'This invitation was sent to a different email address' })
  }
  if (invitation.status === 'accepted') {
    const [acceptedAccount] = await db
      .select({ userId: userTable.id, organizationId: organizationTable.id, organizationName: organizationTable.name })
      .from(memberTable)
      .innerJoin(userTable, eq(userTable.id, memberTable.userId))
      .innerJoin(organizationTable, eq(organizationTable.id, memberTable.organizationId))
      .where(
        and(
          eq(memberTable.organizationId, invitation.organizationId),
          eq(userTable.email, email),
          eq(userTable.emailVerified, true)
        )
      )
      .limit(1)
    if (acceptedAccount) {
      return {
        success: true,
        organization: { id: acceptedAccount.organizationId, name: acceptedAccount.organizationName }
      }
    }
    throw createError({ statusCode: 400, message: 'Invitation is no longer valid' })
  }
  if (invitation.status !== 'pending') {
    throw createError({ statusCode: 400, message: 'Invitation is no longer valid' })
  }
  if (new Date(invitation.expiresAt) < new Date()) {
    throw createError({ statusCode: 400, message: 'Invitation has expired' })
  }
  const [existingUser] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email)).limit(1)
  if (existingUser) {
    throw createError({ statusCode: 409, message: 'An account already exists for this email. Sign in to accept the invitation.' })
  }

  const identity = await getClientAccountIdentity(invitation.organizationId)
  const signup = await auth.api.signUpEmail({
    body: {
      name: identity?.name || email.split('@')[0] || email,
      ...(identity?.firstName ? { firstName: identity.firstName } : {}),
      ...(identity?.lastName ? { lastName: identity.lastName } : {}),
      email,
      password: input.password
    }
  })

  const createdUserId = signup.user.id
  let organization: { id: string; name: string }

  try {
    organization = await db.transaction(async (tx) => {
      const [lockedInvitation] = await tx
        .select()
        .from(invitationTable)
        .where(eq(invitationTable.id, input.invitationId))
        .limit(1)
        .for('update')

      if (!lockedInvitation || lockedInvitation.status !== 'pending') {
        throw createError({ statusCode: 400, message: 'Invitation is no longer valid' })
      }
      if (new Date(lockedInvitation.expiresAt) < new Date()) {
        throw createError({ statusCode: 400, message: 'Invitation has expired' })
      }
      if (lockedInvitation.email.trim().toLowerCase() !== email) {
        throw createError({ statusCode: 400, message: 'This invitation was sent to a different email address' })
      }

      const [targetOrganization] = await tx
        .select({ id: organizationTable.id, name: organizationTable.name })
        .from(organizationTable)
        .where(eq(organizationTable.id, lockedInvitation.organizationId))
        .limit(1)
      if (!targetOrganization) {
        throw createError({ statusCode: 404, message: 'Organization not found' })
      }

      await assertClientInvitationAcceptance(lockedInvitation.organizationId, createdUserId)
      const role = (await isPersonalClient(lockedInvitation.organizationId)) ? 'owner' : lockedInvitation.role || 'member'
      const [existingMember] = await tx
        .select({ id: memberTable.id })
        .from(memberTable)
        .where(
          and(eq(memberTable.organizationId, lockedInvitation.organizationId), eq(memberTable.userId, createdUserId))
        )
        .limit(1)

      if (!existingMember) {
        await tx.insert(memberTable).values({
          id: generateId(),
          organizationId: lockedInvitation.organizationId,
          userId: createdUserId,
          role,
          createdAt: new Date()
        })
      }

      await tx.update(userTable).set({ emailVerified: true, updatedAt: new Date() }).where(eq(userTable.id, createdUserId))
      await tx.update(invitationTable).set({ status: 'accepted' }).where(eq(invitationTable.id, lockedInvitation.id))
      return targetOrganization
    })
  } catch (error) {
    await db.delete(userTable).where(eq(userTable.id, createdUserId))
    throw error
  }

  return { success: true, organization }
})
