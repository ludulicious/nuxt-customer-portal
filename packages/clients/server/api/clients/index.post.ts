import { getPortalRequestContext } from '@nuxt-customer-portal/core/server/portal'
import { requireOwnerClientManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { createClient, getClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { genericClientCreateSchema } from '@nuxt-customer-portal/clients/server/utils/client-validation'

export default defineEventHandler(async (event) => {
  if (getPortalRequestContext()?.mode === 'platform') {
    throw createError({ statusCode: 403, message: 'The platform cannot create clients directly' })
  }
  const { session } = await requireOwnerClientManager(event)
  const input = genericClientCreateSchema.parse(await readBody(event))
  const organizationId = await createClient(session.user.id, input)
  return getClient(organizationId)
})
