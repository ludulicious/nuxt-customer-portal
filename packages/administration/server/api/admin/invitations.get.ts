import { and, asc, count, eq, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { invitation, organization } from '@nuxt-customer-portal/core/schema'
import type { SessionUser } from '@nuxt-customer-portal/core/shared/types/index'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if ((session.user as SessionUser).role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }
  const parsed = z
    .object({ page: z.coerce.number().int().min(1).default(1), search: z.string().trim().default('') })
    .safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid query' })
  }
  const { page, search } = parsed.data
  const where = and(
    eq(invitation.status, 'pending'),
    search ? or(ilike(invitation.email, `%${search}%`), ilike(organization.name, `%${search}%`)) : undefined
  )
  const [items, totals] = await Promise.all([
    db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organizationId: invitation.organizationId,
        organizationName: organization.name,
        expiresAt: invitation.expiresAt
      })
      .from(invitation)
      .innerJoin(organization, eq(organization.id, invitation.organizationId))
      .where(where)
      .orderBy(asc(invitation.email), asc(invitation.id))
      .limit(20)
      .offset((page - 1) * 20),
    db
      .select({ total: count() })
      .from(invitation)
      .innerJoin(organization, eq(organization.id, invitation.organizationId))
      .where(where)
  ])
  return { items, total: totals[0]?.total ?? 0 }
})
