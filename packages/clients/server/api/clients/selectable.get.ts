import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listSelectableClients } from '@nuxt-customer-portal/clients/server/utils/client-repository'

export default defineEventHandler(async (event) => {
  const context = await requireActiveOrganizationRole(event)
  if (context.organizationType !== 'PROVIDER') {
    throw createError({ statusCode: 403, message: 'PROVIDER organization access required' })
  }
  const moduleId = getQuery(event).moduleId
  return listSelectableClients(typeof moduleId === 'string' && moduleId ? moduleId : undefined)
})
