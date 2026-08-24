import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { getOrganizationEmailCredentialStatus } from '@nuxt-customer-portal/core/server/utils/organization-email-provider'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { getOrganizationInvoiceProfile } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const profile = await getOrganizationInvoiceProfile(organizationId)
  const domain = profile.invoiceEmail?.split('@')[1]?.toLowerCase() ?? null
  const status = await getOrganizationEmailCredentialStatus(organizationId, getQuery(event).refresh === '1')
  return {
    email: profile.invoiceEmail,
    domain,
    configured: status.configured,
    verified: Boolean(domain && status.verifiedDomains.includes(domain))
  }
})
