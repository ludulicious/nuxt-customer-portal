import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { requireSession, db } from '@nuxt-customer-portal/core/server/portal'
import { member, user } from '@nuxt-customer-portal/core/schema'
import { timezoneSchema } from '@nuxt-customer-portal/core/server/utils/timezone-validation'
import { clientProfile } from '../db/schema/clients'
import { getClientConfiguration } from '../utils/client-configuration'
import { createClientInTransaction, getClient } from '../utils/client-repository'

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  preferredLocale: z.enum(['nl', 'en']),
  timezone: timezoneSchema.nullable()
})
export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const config = await getClientConfiguration()
  if (!config.personalSelfRegistration || !config.allowedTypes.includes('person')) {
    throw createError({ statusCode: 403, message: 'Personal registration is disabled' })
  }
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid client details', data: { issues: parsed.error.issues } })
  }
  const input = parsed.data
  const id = await db
    .transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('portal-client-configuration'))`)
      if (!(await getClientConfiguration()).personalSelfRegistration) {
        throw createError({ statusCode: 403, message: 'Personal registration is disabled' })
      }
      // Per-user lock makes retries and concurrent onboarding idempotent.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${session.user.id}))`)
      const [account] = await tx.select().from(user).where(eq(user.id, session.user.id)).limit(1)
      if (!account?.emailVerified) {
        throw createError({ statusCode: 403, message: 'Verify your email first' })
      }
      const [existing] = await tx
        .select({ id: member.organizationId })
        .from(member)
        .innerJoin(clientProfile, eq(clientProfile.organizationId, member.organizationId))
        .where(and(eq(member.userId, account.id), eq(clientProfile.clientType, 'person')))
        .limit(1)
      if (existing) {
        return existing.id
      }
      const id = await createClientInTransaction(tx, account.id, {
        ...input,
        name: account.name || `${input.firstName} ${input.lastName}`,
        clientType: 'person',
        address: '',
        invoiceEmail: account.email,
        moduleIds: config.defaultModules ?? []
      })
      await tx
        .insert(member)
        .values({ id: nanoid(), organizationId: id, userId: account.id, role: 'owner', createdAt: new Date() })
      await tx
        .update(user)
        .set({
          timezone: input.timezone,
          firstName: input.firstName,
          lastName: input.lastName
        })
        .where(eq(user.id, account.id))
      return id
    })
    .catch((error: { code?: string; cause?: { code?: string } }) => {
      if (error.code === '23505' || error.cause?.code === '23505') {
        throw createError({ statusCode: 409, message: 'Personal account already exists. Contact your coach.' })
      }
      throw error
    })
  return getClient(id)
})
