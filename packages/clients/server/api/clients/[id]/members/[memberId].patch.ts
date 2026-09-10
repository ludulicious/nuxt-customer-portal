import { isPersonalClient } from '@nuxt-customer-portal/core/server/utils/client-account-policy'
import { and, eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { member } from '@nuxt-customer-portal/core/schema'
import { requireClientMemberManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { genericClientMemberUpdateSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')!
  await requireClientMemberManager(event, organizationId)
  if (await isPersonalClient(organizationId)) {
    throw createError({ statusCode: 403, message: 'Personal membership roles cannot be changed' })
  }
  const input = genericClientMemberUpdateSchema.parse(await readBody(event))
  const [updated] = await db
    .update(member)
    .set(input)
    .where(and(eq(member.id, getRouterParam(event, 'memberId')!), eq(member.organizationId, organizationId)))
    .returning()
  if (!updated) {
    throw createError({ statusCode: 404, message: 'Client member not found' })
  }
  return updated
})
