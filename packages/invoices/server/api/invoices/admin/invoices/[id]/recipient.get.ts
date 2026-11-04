import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getDraftInvoiceRecipient } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesByIdRecipientGet',
    summary: 'Preview current invoice recipient details',
    description:
      'Read current client billing details for an organization-scoped draft. Requires Invoices manage permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return getDraftInvoiceRecipient(organizationId, getRouterParam(event, 'id')!)
})
