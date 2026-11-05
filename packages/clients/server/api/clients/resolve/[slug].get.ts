import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { requireClientProfileManager } from '@nuxt-customer-portal/clients/server/utils/client-access'
import { getClient, getClientBySlug } from '@nuxt-customer-portal/clients/server/utils/client-repository'

export default defineEventHandler(async (event) => {
  await requireActiveOrganizationRole(event)
  const slug = getRouterParam(event, 'slug')!
  const selected = (await getClientBySlug(slug)) ?? (await getClient(slug))
  if (!selected) {
    throw createError({ statusCode: 404, message: 'Client not found' })
  }
  await requireClientProfileManager(event, selected.id)
  return selected
})
