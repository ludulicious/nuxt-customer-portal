import { and, eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { generateId } from '@nuxt-customer-portal/core/server/utils/auth'
import { invitation, organization } from '@nuxt-customer-portal/core/schema'
import { sendEmail } from '@nuxt-customer-portal/core/server/utils/email'
import { getInvitationEmailContent } from '@nuxt-customer-portal/core/server/utils/email-texts'
import { requireClientProfileManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { genericClientInvitationSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')!
  const context = await requireClientProfileManager(event, organizationId)
  const input = genericClientInvitationSchema.parse(await readBody(event))
  const [pending] = await db.select({ id: invitation.id }).from(invitation).where(and(
    eq(invitation.organizationId, organizationId), eq(invitation.email, input.email), eq(invitation.status, 'pending')
  )).limit(1)
  if (pending) throw createError({ statusCode: 409, message: 'A pending invitation already exists' })
  const [client] = await db.select({ name: organization.name }).from(organization).where(and(eq(organization.id, organizationId), eq(organization.organizationType, 'CLIENT'))).limit(1)
  if (!client) throw createError({ statusCode: 404, message: 'Client not found' })
  const id = generateId()
  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  const [created] = await db.insert(invitation).values({ id, email: input.email, role: input.role, organizationId, inviterId: context.session.user.id, status: 'pending', expiresAt }).returning()
  const baseURL = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3000'
  await sendEmail({
    to: input.email,
    ...getInvitationEmailContent({
      inviterName: context.session.user.name || '', inviterEmail: context.session.user.email ?? '',
      organizationName: client.name, role: input.role, invitationLink: `${baseURL}/signup?invitationId=${id}`
    })
  })
  return created
})
