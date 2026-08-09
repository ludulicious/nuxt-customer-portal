import { defineEventHandler, createError, getRouterParam } from 'h3'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { organization as organizationTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { eq } from 'drizzle-orm'
import { checkOrganizationPermission } from '@nuxt-customer-portal/core/server/utils/permissions'
import type { Organization } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalOrganizationsByIdGet',
    summary: 'Get an organization',
    description: 'Get an organization. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

export default defineEventHandler(async (event): Promise<Organization> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'Organization ID is required' })
  }

  // Check if user has permission to read this organization
  const hasPermission = await checkOrganizationPermission(
    session as { user: { id: string, role?: string } },
    organizationId,
    'organization',
    'read'
  )

  if (!hasPermission) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  // Get organization details
  const [organization] = await db
    .select()
    .from(organizationTable)
    .where(eq(organizationTable.id, organizationId))
    .limit(1)

  if (!organization) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  return organization as Organization
})
