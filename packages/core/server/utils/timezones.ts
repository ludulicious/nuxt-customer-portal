import { eq } from 'drizzle-orm'
import { db } from './db'
import { organization, organizationSettings, user } from '../db/schema/auth-schema'
import { DEFAULT_TIMEZONE, resolveTimezones } from '../../shared/timezone'

export const getProviderTimezone = async () => {
  const [provider] = await db
    .select({ timezone: organizationSettings.timezone })
    .from(organization)
    .leftJoin(organizationSettings, eq(organization.id, organizationSettings.organizationId))
    .where(eq(organization.organizationType, 'PROVIDER'))
    .limit(1)
  return provider?.timezone || DEFAULT_TIMEZONE
}
type ClientTimezoneResolver = (id: string) => Promise<string | null>
let clientResolver: ClientTimezoneResolver = async () => null
export const registerClientTimezoneResolver = (resolver: ClientTimezoneResolver) => {
  clientResolver = resolver
}
/** Caller must authorize the user and active organization before exposing this projection. */
export const getResolvedTimezones = async (userId: string, clientOrganizationId?: string | null) => {
  const [providerTimezone, clientTimezone, users] = await Promise.all([
    getProviderTimezone(),
    clientOrganizationId ? clientResolver(clientOrganizationId) : null,
    db.select({ timezone: user.timezone }).from(user).where(eq(user.id, userId)).limit(1)
  ])
  return resolveTimezones({ providerTimezone, clientTimezone, userTimezone: users[0]?.timezone ?? null })
}
