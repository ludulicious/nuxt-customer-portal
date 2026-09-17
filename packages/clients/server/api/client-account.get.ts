import { and, eq } from 'drizzle-orm'
import { requireSession, db } from '@nuxt-customer-portal/core/server/portal'
import { member } from '@nuxt-customer-portal/core/schema'
import { clientProfile } from '../db/schema/clients'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  return db
    .select({ organizationId: clientProfile.organizationId, clientType: clientProfile.clientType })
    .from(clientProfile)
    .innerJoin(member, and(eq(member.organizationId, clientProfile.organizationId), eq(member.userId, session.user.id)))
})
