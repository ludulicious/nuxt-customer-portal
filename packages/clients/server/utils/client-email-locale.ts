import { eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { clientProfile } from '../db/schema/clients'

export const getClientEmailLocale = async (
  organizationId: string | null,
  fallback: 'nl' | 'en' = 'nl'
): Promise<'nl' | 'en'> => {
  if (!organizationId) {
    return fallback
  }
  const [profile] = await db
    .select({ locale: clientProfile.preferredLocale })
    .from(clientProfile)
    .where(eq(clientProfile.organizationId, organizationId))
    .limit(1)
  return profile ? (profile.locale === 'en' ? 'en' : 'nl') : fallback
}
