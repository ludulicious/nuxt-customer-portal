import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listClientInvoiceViewers } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { isPersonalClient } from '@nuxt-customer-portal/core/server/utils/client-account-policy'

export default defineEventHandler(async (event) => {
  const { organizationId, role } = await requireActiveOrganizationRole(event)
  if (!['owner', 'admin'].includes(role)) {
    throw createError({ statusCode: 403, message: 'Client administrator access required' })
  }
  if (await isPersonalClient(organizationId)) {
    throw createError({ statusCode: 403, message: 'Personal clients cannot manage invoice viewers' })
  }
  return listClientInvoiceViewers(getRouterParam(event, 'accessId')!, organizationId)
})
