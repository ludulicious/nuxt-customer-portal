import { and, eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { invitation, organization, user } from '@nuxt-customer-portal/core/schema'
import { sendEmail } from '@nuxt-customer-portal/core/server/utils/email'
import {
  getInvitationEmailContent,
  getPersonalAccountInvitationEmailContent
} from '@nuxt-customer-portal/core/server/utils/email-texts'
import { requireClientMemberManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { clientProfile } from '@nuxt-customer-portal/clients/server/db/schema/clients'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')!
  const invitationId = getRouterParam(event, 'invitationId')!
  await requireClientMemberManager(event, organizationId)

  const [pending] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationName: organization.name,
      inviterName: user.name,
      inviterEmail: user.email,
      clientType: clientProfile.clientType,
      firstName: clientProfile.firstName,
      preferredLocale: clientProfile.preferredLocale
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .innerJoin(user, eq(user.id, invitation.inviterId))
    .leftJoin(clientProfile, eq(clientProfile.organizationId, invitation.organizationId))
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, 'pending')
      )
    )
    .limit(1)

  if (!pending) {
    throw createError({ statusCode: 409, message: 'Invitation is no longer pending' })
  }

  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  await db
    .update(invitation)
    .set({ expiresAt })
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, 'pending')
      )
    )

  const baseURL = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3000'
  const invitationLink = `${baseURL}/signup?invitationId=${invitationId}`
  await sendEmail({
    to: pending.email,
    locale: pending.preferredLocale ?? undefined,
    ...(pending.clientType === 'person'
      ? getPersonalAccountInvitationEmailContent({
          invitationLink,
          recipientName: pending.firstName || pending.organizationName
        })
      : getInvitationEmailContent({
          inviterName: pending.inviterName || '',
          inviterEmail: pending.inviterEmail,
          organizationName: pending.organizationName,
          role: pending.role || 'member',
          invitationLink
        }))
  })

  return { success: true, expiresAt }
})
