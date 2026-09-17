import { and, eq, isNull, notExists } from 'drizzle-orm'
import { db, requireSession } from '@nuxt-customer-portal/core/server/portal'
import { organization, member } from '@nuxt-customer-portal/core/schema'
import { clientProfile } from '../../../db/schema/clients'
import { requireAllowedClientType } from '../../../utils/client-configuration'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403 })
  }
  await requireAllowedClientType('person')
  return db
    .select({ id: clientProfile.organizationId, name: organization.name, email: clientProfile.invoiceEmail })
    .from(clientProfile)
    .innerJoin(organization, eq(organization.id, clientProfile.organizationId))
    .where(
      and(
        eq(clientProfile.clientType, 'person'),
        isNull(clientProfile.archivedAt),
        notExists(
          db.select({ id: member.id }).from(member).where(eq(member.organizationId, clientProfile.organizationId))
        )
      )
    )
    .orderBy(organization.name)
})
