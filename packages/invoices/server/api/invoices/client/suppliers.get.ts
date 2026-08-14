import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listClientInvoiceSuppliers } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  return listClientInvoiceSuppliers(organizationId, session.user.id, isAdmin)
})
