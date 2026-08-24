import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { user as userTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import type { AdminUserResponse, SessionUser } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminUsersByIdGet',
    summary: 'Get a user',
    description: 'Get a user by ID. Requires a system administrator session.'
  }
})

export default defineEventHandler(async (event): Promise<AdminUserResponse> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const sessionUser = session.user as SessionUser
  if (sessionUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const [user] = await db.select().from(userTable).where(eq(userTable.id, id)).limit(1)

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return user as AdminUserResponse
})
