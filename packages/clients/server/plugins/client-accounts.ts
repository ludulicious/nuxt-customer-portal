import { and, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { member } from '@nuxt-customer-portal/core/schema'
import { registerClientAccountPolicy } from '@nuxt-customer-portal/core/server/utils/client-account-policy'
import { registerClientTimezoneResolver } from '@nuxt-customer-portal/core/server/utils/timezones'
import { clientProfile } from '../db/schema/clients'
import { getClientConfiguration, setClientConfigurationValidation } from '../utils/client-configuration'

export default defineNitroPlugin(() => {
  const config = getClientConfiguration()
  // Nitro does not await plugin return values. Register policies synchronously,
  // and gate requests on database validation instead of leaving a startup gap.
  const configurationReady = db
    .selectDistinct({ clientType: clientProfile.clientType })
    .from(clientProfile)
    .then((profiles) =>
      profiles.some((row) => !config.allowedTypes.includes(row.clientType))
        ? 'Cannot disable a client type while clients of that type exist'
        : null
    )
    .catch(() => 'Client configuration could not be validated. Check database migrations and connectivity.')
  setClientConfigurationValidation(configurationReady)
  const profile = async (id: string) =>
    (await db.select().from(clientProfile).where(eq(clientProfile.organizationId, id)).limit(1))[0]
  registerClientTimezoneResolver(async (id) => (await profile(id))?.timezone ?? null)
  registerClientAccountPolicy({
    isPersonal: async (id) => (await profile(id))?.clientType === 'person',
    assertAcceptance: async (id, userId) => {
      const client = await profile(id)
      if (client?.archivedAt) {
        throw createError({ statusCode: 403, message: 'Archived clients cannot accept invitations' })
      }
      if (client?.clientType !== 'person') {
        return
      }
      const existing = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.organizationId, id))
        .limit(1)
      const personal = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            inArray(
              member.organizationId,
              db
                .select({ id: clientProfile.organizationId })
                .from(clientProfile)
                .where(eq(clientProfile.clientType, 'person'))
            )
          )
        )
        .limit(1)
      if (existing.length || personal.length) {
        throw createError({
          statusCode: 409,
          message: 'A personal account already exists. Contact your coach to reconcile the accounts.'
        })
      }
    }
  })
})
