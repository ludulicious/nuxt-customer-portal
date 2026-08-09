import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import type { SessionUser } from '@nuxt-customer-portal/core/shared/types/index'
import { member as memberTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminOrganizationsByIdMembersByMemberIdDelete',
    summary: 'Remove an organization member',
    description: 'Remove another user from an organization. System admins and organization owners or admins are authorized.'
  }
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const user = session.user as SessionUser
  const organizationId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')
  if (!organizationId || !memberId) throw createError({ statusCode: 400, message: 'Organization ID and member ID are required' })

  if (user.role !== 'admin') {
    const [actor] = await db.select({ role: memberTable.role }).from(memberTable).where(and(
      eq(memberTable.organizationId, organizationId),
      eq(memberTable.userId, user.id)
    )).limit(1)
    if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
      throw createError({ statusCode: 403, message: 'Only organization owners and admins can remove members' })
    }
  }

  const [target] = await db.select().from(memberTable).where(and(
    eq(memberTable.id, memberId),
    eq(memberTable.organizationId, organizationId)
  )).limit(1)
  if (!target) throw createError({ statusCode: 404, message: 'Organization member not found' })
  if (target.userId === user.id) throw createError({ statusCode: 400, message: 'You cannot remove yourself from the organization' })

  if (target.role === 'owner') {
    const owners = await db.select({ id: memberTable.id }).from(memberTable).where(and(
      eq(memberTable.organizationId, organizationId),
      eq(memberTable.role, 'owner')
    ))
    if (owners.length <= 1) throw createError({ statusCode: 409, message: 'The last organization owner cannot be removed' })
  }

  await db.delete(memberTable).where(and(
    eq(memberTable.id, memberId),
    eq(memberTable.organizationId, organizationId)
  ))

  return { success: true }
})
