import { and, count, eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { member } from '@nuxt-customer-portal/core/schema'
import { requireClientProfileManager } from '@nuxt-customer-portal/clients/server/utils/client-access'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')!
  await requireClientProfileManager(event, organizationId)
  const memberId = getRouterParam(event, 'memberId')!
  const [selected] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
    .limit(1)
  if (!selected) {
    throw createError({ statusCode: 404, message: 'Client member not found' })
  }
  if (selected.role === 'owner') {
    const [owners] = await db
      .select({ total: count() })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.role, 'owner')))
    if (Number(owners?.total ?? 0) <= 1) {
      throw createError({ statusCode: 409, message: 'The last client owner cannot be removed' })
    }
  }
  await db.delete(member).where(eq(member.id, memberId))
  return { deleted: true }
})
