import { and, eq, inArray, or } from 'drizzle-orm'
import { member, organization, user } from '../db/schema/auth-schema'
import { db } from './db'
import { getOrganizationAvatar } from '../../shared/organization-avatar'
import { getActiveOrganizationId, type PortalSession } from '../../shared/portal-session'
import type { PortalImageField, PortalImageKind } from './portal-image'

export const readPortalImage = async (
  session: PortalSession,
  kind: PortalImageKind,
  id: string,
  field: PortalImageField
): Promise<string | null> => {
  const activeId = getActiveOrganizationId(session)
  const memberships = await db
    .select({ organizationId: member.organizationId, role: member.role, type: organization.organizationType })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, session.user.id))
  const providerManager = memberships.some(
    (item) => item.organizationId === activeId && item.type === 'PROVIDER' && ['owner', 'admin'].includes(item.role)
  )
  const systemAdmin = session.user.role === 'admin'
  if (kind === 'organization') {
    const [selected] = await db.select().from(organization).where(eq(organization.id, id)).limit(1)
    const allowed =
      memberships.some((item) => item.organizationId === id) ||
      (providerManager && selected?.organizationType === 'CLIENT') ||
      systemAdmin
    return allowed && selected ? (field === 'logo' ? selected.logo : (getOrganizationAvatar(selected) ?? null)) : null
  }
  if (field !== 'avatar') {
    return null
  }
  if (id !== session.user.id && !systemAdmin) {
    const ids = memberships.map((item) => item.organizationId)
    if (!ids.length) {
      return null
    }
    const [shared] = await db
      .select({ id: member.id })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(
        and(
          eq(member.userId, id),
          providerManager
            ? or(inArray(member.organizationId, ids), eq(organization.organizationType, 'CLIENT'))
            : inArray(member.organizationId, ids)
        )
      )
      .limit(1)
    if (!shared) {
      return null
    }
  }
  const [selected] = await db.select({ image: user.image }).from(user).where(eq(user.id, id)).limit(1)
  return selected?.image ?? null
}
