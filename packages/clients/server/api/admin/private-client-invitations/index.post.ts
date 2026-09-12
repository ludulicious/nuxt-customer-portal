import { privateClientInvitationSchema } from '../../../../shared/private-client-invitation'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db, requireSession } from '@nuxt-customer-portal/core/server/portal'
import { invitation, member, user } from '@nuxt-customer-portal/core/schema'
import { sendEmail } from '@nuxt-customer-portal/core/server/utils/email'
import { getInvitationEmailContent } from '@nuxt-customer-portal/core/server/utils/email-texts'
import { clientProfile } from '../../../db/schema/clients'
import { getClientConfiguration } from '../../../utils/client-configuration'
import { createClientInTransaction, getClient } from '../../../utils/client-repository'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403 })
  }
  const parsed = privateClientInvitationSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid invitation details' })
  }
  const input = parsed.data
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('portal-client-configuration'))`)
    const config = await getClientConfiguration()
    if (!config.allowedTypes.includes('person')) {
      throw createError({ statusCode: 403, message: 'Private clients are disabled' })
    }
    const [retry] = await tx.select().from(invitation).where(eq(invitation.id, input.requestId))
    if (retry) {
      if (
        retry.inviterId !== session.user.id ||
        retry.email !== input.email ||
        (input.clientId && retry.organizationId !== input.clientId)
      ) {
        throw createError({ statusCode: 409, message: 'Invitation request already used' })
      }
      return { invitation: retry, created: false }
    }
    const [personalOwner] = await tx
      .select({ id: member.id })
      .from(user)
      .innerJoin(member, eq(member.userId, user.id))
      .innerJoin(clientProfile, eq(clientProfile.organizationId, member.organizationId))
      .where(and(sql`lower(${user.email}) = ${input.email}`, eq(clientProfile.clientType, 'person')))
      .limit(1)
    if (personalOwner) {
      throw createError({ statusCode: 409, message: 'This user already has a private client account' })
    }
    const [pendingForEmail] = await tx
      .select({ id: invitation.id })
      .from(invitation)
      .innerJoin(clientProfile, eq(clientProfile.organizationId, invitation.organizationId))
      .where(
        and(
          sql`lower(${invitation.email}) = ${input.email}`,
          eq(invitation.status, 'pending'),
          gt(invitation.expiresAt, new Date()),
          eq(clientProfile.clientType, 'person')
        )
      )
      .limit(1)
    if (pendingForEmail) {
      throw createError({
        statusCode: 409,
        message:
          'A private-client invitation is already pending for this email. Revoke it from Pending invitations before inviting the existing private client again.'
      })
    }
    let clientId = input.clientId
    if (clientId) {
      const [profile] = await tx.select().from(clientProfile).where(eq(clientProfile.organizationId, clientId))
      const [linked] = await tx
        .select({ id: member.id })
        .from(member)
        .where(eq(member.organizationId, clientId))
        .limit(1)
      const [pending] = await tx
        .select({ id: invitation.id })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, clientId),
            eq(invitation.status, 'pending'),
            gt(invitation.expiresAt, new Date())
          )
        )
        .limit(1)
      if (!profile || profile.clientType !== 'person' || profile.archivedAt || linked || pending) {
        throw createError({
          statusCode: 409,
          message: 'Choose an active private client without a linked user or pending invitation'
        })
      }
    } else {
      const [firstName, ...lastNameParts] = input.name!.trim().split(/\s+/)
      clientId = await createClientInTransaction(tx, session.user.id, {
        clientType: 'person',
        name: input.name!,
        firstName: firstName!,
        lastName: lastNameParts.join(' ') || firstName!,
        invoiceEmail: input.email,
        address: '',
        preferredLocale: input.preferredLocale,
        timezone: null,
        moduleIds: config.defaultModules ?? []
      })
    }
    const [created] = await tx
      .insert(invitation)
      .values({
        id: input.requestId,
        organizationId: clientId,
        email: input.email,
        inviterId: session.user.id,
        role: 'owner',
        status: 'pending',
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      })
      .returning()
    return { invitation: created!, created: true }
  })
  if (result.created) {
    const client = await getClient(result.invitation.organizationId)
    const baseURL = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3000'
    try {
      await sendEmail({
        to: input.email,
        ...getInvitationEmailContent({
          inviterName: session.user.name || '',
          inviterEmail: session.user.email || '',
          organizationName: client!.name,
          role: 'owner',
          invitationLink: `${baseURL}/signup?invitationId=${result.invitation.id}`
        })
      })
    } catch {
      return { invitationId: result.invitation.id, deliveryFailed: true }
    }
  }
  return { invitationId: result.invitation.id, deliveryFailed: false }
})
