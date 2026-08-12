import { defineEventHandler, createError, getRouterParam, readBody } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { user as userTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { count, eq } from 'drizzle-orm'
import type { SessionUser, UpdateUserRoleRequest, UpdateUserRoleResponse } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminUsersByIdRolePatch',
    summary: 'Update a user role',
    description: 'Update a user role. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event): Promise<UpdateUserRoleResponse> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // Check if user is admin
  const user = session.user as SessionUser
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const body = await readBody<UpdateUserRoleRequest>(event)
  const { role } = body

  if (!role || !['user', 'admin'].includes(role)) {
    throw createError({ statusCode: 400, message: 'Invalid role. Must be "user" or "admin"' })
  }

  const [target] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)

  if (!target) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if (userId === user.id && role !== 'admin') {
    throw createError({ statusCode: 400, message: 'You cannot remove your own system administrator role' })
  }

  if (target.role === 'admin' && role !== 'admin') {
    const [result] = await db
      .select({ total: count() })
      .from(userTable)
      .where(eq(userTable.role, 'admin'))
    if ((result?.total ?? 0) <= 1) {
      throw createError({ statusCode: 400, message: 'The last system administrator cannot be demoted' })
    }
  }

  // Update user role
  await db
    .update(userTable)
    .set({ role })
    .where(eq(userTable.id, userId))

  return { success: true, message: 'User role updated successfully' }
})
