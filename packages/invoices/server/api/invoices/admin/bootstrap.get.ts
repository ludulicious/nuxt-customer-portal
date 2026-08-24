import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import {
  getInvoiceSettings,
  getOrganizationInvoiceProfile,
  listInvoiceClients
} from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const [settings, clients, organizationProfile] = await Promise.all([
    getInvoiceSettings(organizationId),
    listInvoiceClients(organizationId),
    getOrganizationInvoiceProfile(organizationId)
  ])
  return { settings, clients, organizationProfile }
})
