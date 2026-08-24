import { defineEventHandler, createError } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { user as userTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { or, ilike } from 'drizzle-orm'
import type { SessionUser, AdminUsersResponse } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminUsersGet',
    summary: 'List users',
    description: 'List users. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event): Promise<AdminUsersResponse> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // Check if user is admin
  const user = session.user as SessionUser
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  // Get search query parameter
  const query = getQuery(event)
  const search = query.search as string | undefined

  // Build base query
  const baseQuery = db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: userTable.role,
      emailVerified: userTable.emailVerified,
      createdAt: userTable.createdAt,
      updatedAt: userTable.updatedAt,
      banned: userTable.banned,
      banReason: userTable.banReason,
      banExpires: userTable.banExpires
    })
    .from(userTable)

  // Add search filter if provided
  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`
    const users = await baseQuery
      .where(or(ilike(userTable.name, searchPattern), ilike(userTable.email, searchPattern)))
      .orderBy(userTable.createdAt)
    return users as AdminUsersResponse
  }

  // Get all users ordered by creation date
  const users = await baseQuery.orderBy(userTable.createdAt)

  return users as AdminUsersResponse
})
