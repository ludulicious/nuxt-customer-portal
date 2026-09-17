import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { setClientInvoiceViewer } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { isPersonalClient } from '@nuxt-customer-portal/core/server/utils/client-account-policy'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  if (!['owner', 'admin'].includes(role)) {
    throw createError({ statusCode: 403, message: 'Client administrator access required' })
  }
  if (await isPersonalClient(organizationId)) {
    throw createError({ statusCode: 403, message: 'Personal clients cannot manage invoice viewers' })
  }
  const body = await readBody<{ userId: string; assigned: boolean }>(event)
  return setClientInvoiceViewer(
    getRouterParam(event, 'accessId')!,
    organizationId,
    session.user.id,
    body.userId,
    body.assigned
  )
})
