import { z } from 'zod'
import { requireActiveOrganizationRole, db } from '@nuxt-customer-portal/core/server/portal'
import { organizationSettings } from '@nuxt-customer-portal/core/schema'
import { timezoneSchema } from '@nuxt-customer-portal/core/server/utils/timezone-validation'

export default defineEventHandler(async (event) => {
  const context = await requireActiveOrganizationRole(event)
  if (context.organizationType !== 'PROVIDER' || !['owner', 'admin'].includes(context.role ?? '')) {
    throw createError({ statusCode: 403 })
  }
  const parsed = z.object({ timezone: timezoneSchema }).safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'A valid IANA timezone is required' })
  }
  const input = parsed.data
  await db
    .insert(organizationSettings)
    .values({ organizationId: context.organizationId, ...input })
    .onConflictDoUpdate({ target: organizationSettings.organizationId, set: input })
  return input
})
