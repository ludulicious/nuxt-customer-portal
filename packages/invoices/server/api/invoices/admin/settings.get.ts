import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getInvoiceSettings } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return getInvoiceSettings(organizationId)
})
