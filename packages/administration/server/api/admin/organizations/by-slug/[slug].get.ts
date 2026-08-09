import { defineEventHandler, createError, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { organization as organizationTable, member as memberTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import type { SessionUser, Organization } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminOrganizationsBySlugBySlugGet',
    summary: 'Get an organization by slug',
    description: 'Get an organization by slug. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event): Promise<Organization> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const user = session.user as SessionUser
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  // Get organization by slug
  const [organization] = await db
    .select()
    .from(organizationTable)
    .where(eq(organizationTable.slug, slug))
    .limit(1)

  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  // Check if user is admin - admins have full access
  if (user.role === 'admin') {
    return organization as Organization
  }

  // For non-admin users, check if they are a member of this organization
  const [member] = await db
    .select()
    .from(memberTable)
    .where(
      and(
        eq(memberTable.userId, user.id),
        eq(memberTable.organizationId, organization.id)
      )
    )
    .limit(1)

  if (!member) {
    throw createError({ statusCode: 403, message: 'Access denied. You must be an admin or a member of this organization.' })
  }

  // Check if user has organization.read permission
  // Members, admins, and owners all have organization.read permission
  // (as defined in permissions.get.ts)
  // So if they're a member, they have read permission
  return organization as Organization
})
