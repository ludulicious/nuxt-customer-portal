import type { H3Event } from 'h3'
import { and, asc, eq, ilike, inArray, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { PortalFeaturePolicy, PortalOrganizationRole } from '@nuxt-customer-portal/core/shared/types/feature'
import { canManageOrganizationEmailCredential, isPortalActionAllowed } from '@nuxt-customer-portal/core/shared/feature-registry'
import { getActiveOrganizationId, type PortalSession } from '@nuxt-customer-portal/core/shared/portal-session'
import { member, organization, user } from './db/schema/auth-schema'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { getUserOrganizationRole } from '@nuxt-customer-portal/core/server/utils/permissions'

export { db }
export type { PortalSession } from '@nuxt-customer-portal/core/shared/portal-session'

export const getSession = async (event: H3Event): Promise<PortalSession | null> => {
  const session = await auth.api.getSession({ headers: event.headers })
  return session as PortalSession | null
}

export const requireSession = async (event: H3Event): Promise<PortalSession> => {
  const session = await getSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return session
}

export const requireActiveOrganization = (session: PortalSession): string => {
  // Better Auth has returned both shapes across versions/configurations.
  // Keep the layer adapter compatible with either so feature APIs do not
  // lose their tenant context during a layer or auth upgrade.
  const organizationId = getActiveOrganizationId(session)
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'No active organization' })
  }
  return organizationId
}

export const authorize = async <Action extends string>(
  session: PortalSession,
  organizationId: string,
  policy: PortalFeaturePolicy<Action>,
  action: Action
): Promise<void> => {
  const role = await getUserOrganizationRole(session.user.id, organizationId) as PortalOrganizationRole | null
  if (!isPortalActionAllowed(policy, role, action, session.user.role === 'admin')) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }
}

export const hasFeatureAccess = async <Action extends string>(
  session: PortalSession,
  organizationId: string,
  policy: PortalFeaturePolicy<Action>,
  action: Action
): Promise<boolean> => {
  const role = await getUserOrganizationRole(session.user.id, organizationId) as PortalOrganizationRole | null
  return isPortalActionAllowed(policy, role, action, session.user.role === 'admin')
}

export const requireFeatureAccess = async <Action extends string>(
  event: H3Event,
  policy: PortalFeaturePolicy<Action>,
  action: Action
) => {
  const session = await requireSession(event)
  const organizationId = requireActiveOrganization(session)
  await authorize(session, organizationId, policy, action)
  return { session, organizationId }
}

export const requireActiveOrganizationRole = async (event: H3Event) => {
  const session = await requireSession(event)
  const organizationId = requireActiveOrganization(session)
  const role = await getUserOrganizationRole(session.user.id, organizationId) as PortalOrganizationRole | null
  if (!role && session.user.role !== 'admin') throw createError({ statusCode: 403, message: 'Organization membership required' })
  return { session, organizationId, role }
}

export const requireOrganizationOwnerOrSystemAdmin = async (event: H3Event, requestedOrganizationId?: string) => {
  const session = await requireSession(event)
  const activeOrganizationId = getActiveOrganizationId(session)
  if (requestedOrganizationId && requestedOrganizationId !== activeOrganizationId && session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Organization owner access required' })
  }
  const organizationId = session.user.role === 'admin' && requestedOrganizationId
    ? requestedOrganizationId
    : requireActiveOrganization(session)
  const role = await getUserOrganizationRole(session.user.id, organizationId)
  if (!canManageOrganizationEmailCredential(role as PortalOrganizationRole | null, session.user.role === 'admin')) throw createError({ statusCode: 403, message: 'Organization owner access required' })
  return { session, organizationId }
}

/**
 * Stable portal-core projections used by feature layers. Keeping these here
 * prevents features from importing host authentication tables at runtime.
 */
export const listPortalOrganizationMembers = async (organizationId: string) =>
  db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    organizationRole: member.role
  })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(user.name), asc(user.email))

export const searchPortalOrganizations = async (
  workspaceOrganizationId: string,
  search?: string
) =>
  db.select({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    metadata: organization.metadata
  })
    .from(organization)
    .where(and(
      ne(organization.id, workspaceOrganizationId),
      search ? ilike(organization.name, `%${search}%`) : undefined
    ))
    .orderBy(asc(organization.name))
    .limit(50)

export const listPortalOrganizationsForUser = async (
  userId: string,
  hasSystemAccess = false
) => {
  const selection = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo
  }
  if (hasSystemAccess) {
    return db.select(selection).from(organization).orderBy(asc(organization.name))
  }
  return db.select(selection)
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name))
}

export const getPortalOrganizationsByIds = async (organizationIds: string[]) => {
  if (!organizationIds.length) return []
  return db.select({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    metadata: organization.metadata
  })
    .from(organization)
    .where(inArray(organization.id, organizationIds))
    .orderBy(asc(organization.name))
}

export const createPortalOrganizationRecord = async (input: {
  name: string
  slug: string
  logo?: string | null
}) => {
  const [created] = await db.insert(organization).values({
    id: nanoid(),
    name: input.name,
    slug: input.slug,
    logo: input.logo ?? null,
    createdAt: new Date()
  }).returning({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo
  })
  return created
}
