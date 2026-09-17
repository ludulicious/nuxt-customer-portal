import { z } from 'zod'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { requireSession, db } from '@nuxt-customer-portal/core/server/portal'
import { member } from '@nuxt-customer-portal/core/schema'
import { clientProfile } from '../../db/schema/clients'

const schema = z.object({ address: z.string().trim().max(1000) }).strict()
export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid address', data: { issues: parsed.error.issues } })
  }
  const [client] = await db
    .update(clientProfile)
    .set({ address: parsed.data.address, updatedAt: new Date() })
    .where(
      and(
        eq(clientProfile.clientType, 'person'),
        isNull(clientProfile.archivedAt),
        inArray(
          clientProfile.organizationId,
          db.select({ id: member.organizationId }).from(member).where(eq(member.userId, session.user.id))
        )
      )
    )
    .returning({ address: clientProfile.address })
  if (!client) {
    throw createError({ statusCode: 404, message: 'No active personal client account' })
  }
  return { address: client.address, archived: false }
})
