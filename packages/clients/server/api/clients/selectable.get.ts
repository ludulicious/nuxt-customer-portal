import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listSelectableClients } from '@nuxt-customer-portal/clients/server/utils/client-repository'

export default defineEventHandler(async (event) => {
  const context = await requireActiveOrganizationRole(event)
  if (context.organizationType !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'OWNER organization access required' })
  }
  const moduleId = getQuery(event).moduleId
  return listSelectableClients(typeof moduleId === 'string' && moduleId ? moduleId : undefined)
})
