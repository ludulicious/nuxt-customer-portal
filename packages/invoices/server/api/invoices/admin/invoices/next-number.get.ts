import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getNextInvoiceNumber } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesNextNumberGet',
    summary: 'Suggest the next invoice number'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return { number: await getNextInvoiceNumber(organizationId) }
})
