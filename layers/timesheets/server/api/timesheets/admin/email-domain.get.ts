import { requireFeatureAccess } from '#portal/server/portal'
import { getOrganizationEmailCredentialStatus } from '#portal/server/utils/organization-email-provider'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { getOrganizationInvoiceProfile } from '#layers/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminEmailDomainGet',
    summary: 'Get the invoice sending-domain status',
    description: 'Get the invoice sending-domain status. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const profile = await getOrganizationInvoiceProfile(organizationId)
  const domain = profile.invoiceEmail?.split('@')[1]?.toLowerCase() ?? null
  if (!domain) return { email: profile.invoiceEmail, domain, configured: false, verified: false }
  const status = await getOrganizationEmailCredentialStatus(organizationId, getQuery(event).refresh === '1')
  return { email: profile.invoiceEmail, domain, configured: status.configured, verified: status.verifiedDomains.includes(domain) }
})
