import { and, eq } from 'drizzle-orm'
import { requireSession, db } from '@nuxt-customer-portal/core/server/portal'
import { member } from '@nuxt-customer-portal/core/schema'
import { clientProfile } from '../../db/schema/clients'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const [client] = await db
    .select({ address: clientProfile.address, archived: clientProfile.archivedAt })
    .from(clientProfile)
    .innerJoin(member, eq(member.organizationId, clientProfile.organizationId))
    .where(and(eq(member.userId, session.user.id), eq(clientProfile.clientType, 'person')))
    .limit(1)
  return client ? { address: client.address, archived: Boolean(client.archived) } : null
})
