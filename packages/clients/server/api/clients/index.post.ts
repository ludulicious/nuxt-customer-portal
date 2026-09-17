import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { createClient, getClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { genericClientCreateSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  const { session } = await requireOwnerClientManager(event)
  const parsed = genericClientCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid client details', data: { issues: parsed.error.issues } })
  }
  const input = parsed.data
  const organizationId = await createClient(session.user.id, input)
  return getClient(organizationId)
})
