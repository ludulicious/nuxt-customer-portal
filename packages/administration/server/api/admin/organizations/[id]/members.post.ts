import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import type { SessionUser } from '@nuxt-customer-portal/core/shared/types/index'
import { member as memberTable, organization as organizationTable, user as userTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { auth, generateId } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { linkOrganizationMemberSchema } from '../../../../utils/organization-member-validation'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminOrganizationsByIdMembersPost',
    summary: 'Link an existing user to an organization',
    description: 'Create an organization membership for an existing portal user. Requires system administrator access.'
  }
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const actor = session.user as SessionUser
  if (actor.role !== 'admin') throw createError({ statusCode: 403, message: 'Admin access required' })

  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) throw createError({ statusCode: 400, message: 'Organization ID is required' })

  const parsed = linkOrganizationMemberSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'A valid user and organization role are required' })

  const [organization] = await db.select({ id: organizationTable.id }).from(organizationTable).where(eq(organizationTable.id, organizationId)).limit(1)
  if (!organization) throw createError({ statusCode: 404, message: 'Organization not found' })

  const [existingUser] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.id, parsed.data.userId)).limit(1)
  if (!existingUser) throw createError({ statusCode: 404, message: 'User not found' })

  const [existingMember] = await db.select({ id: memberTable.id }).from(memberTable).where(and(
    eq(memberTable.organizationId, organizationId),
    eq(memberTable.userId, parsed.data.userId)
  )).limit(1)
  if (existingMember) throw createError({ statusCode: 409, message: 'User is already a member of this organization' })

  const [member] = await db.insert(memberTable).values({
    id: generateId(),
    organizationId,
    userId: parsed.data.userId,
    role: parsed.data.role,
    createdAt: new Date()
  }).returning()

  return member
})
