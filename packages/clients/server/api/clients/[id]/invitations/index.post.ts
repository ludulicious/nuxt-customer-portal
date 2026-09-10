import { isPersonalClient } from '@nuxt-customer-portal/core/server/utils/client-account-policy'
import { and, eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { generateId } from '@nuxt-customer-portal/core/server/utils/auth'
import { invitation, organization, member } from '@nuxt-customer-portal/core/schema'
import { sendEmail } from '@nuxt-customer-portal/core/server/utils/email'
import { getInvitationEmailContent } from '@nuxt-customer-portal/core/server/utils/email-texts'
import { requireClientMemberManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { genericClientInvitationSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')!
  const context = await requireClientMemberManager(event, organizationId)
  const parsedInput = genericClientInvitationSchema.safeParse(await readBody(event))
  if (!parsedInput.success) {
    throw createError({ statusCode: 400, message: 'A valid email address and role are required' })
  }
  const input = parsedInput.data
  if (await isPersonalClient(organizationId)) {
    input.role = 'owner'
    const existing = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.organizationId, organizationId))
      .limit(1)
    if (existing.length) {
      throw createError({ statusCode: 409, message: 'Personal client already has an account' })
    }
  }
  const [pending] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.email, input.email),
        eq(invitation.status, 'pending')
      )
    )
    .limit(1)
  if (pending) {
    throw createError({ statusCode: 409, message: 'A pending invitation already exists' })
  }
  const [client] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(and(eq(organization.id, organizationId), eq(organization.organizationType, 'CLIENT')))
    .limit(1)
  if (!client) {
    throw createError({ statusCode: 404, message: 'Client not found' })
  }
  const id = generateId()
  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  const [created] = await db
    .insert(invitation)
    .values({
      id,
      email: input.email,
      role: input.role,
      organizationId,
      inviterId: context.session.user.id,
      status: 'pending',
      expiresAt
    })
    .returning()
  const baseURL = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3000'
  await sendEmail({
    to: input.email,
    ...getInvitationEmailContent({
      inviterName: context.session.user.name || '',
      inviterEmail: context.session.user.email ?? '',
      organizationName: client.name,
      role: input.role,
      invitationLink: `${baseURL}/signup?invitationId=${id}`
    })
  })
  return created
})
