import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { invoiceListQuerySchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'
import { listInvoicesPage } from '@nuxt-customer-portal/invoices/server/utils/invoice-listing'
import { requireInvoicesEnabled } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoicesAdminInvoicesGet',
    summary: 'List invoices',
    description: 'List invoices. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  await requireInvoicesEnabled(organizationId)
  return listInvoicesPage(organizationId, invoiceListQuerySchema.parse(getQuery(event)))
})
