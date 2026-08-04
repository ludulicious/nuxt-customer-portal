import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import {
  ensureSettings,
  listActivities,
  listApprovalQueue,
  listAvailableClientOrganizations,
  listClients,
  listInvoices,
  listInvoiceableEntries,
  getOrganizationInvoiceProfile,
  listProjects,
  listTeam
} from '#layers/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminBootstrapGet',
    summary: 'Get timesheets administration data',
    description: 'Get timesheets administration data. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  const section = String(getQuery(event).section ?? '')
  const settings = await ensureSettings(organizationId)
  const [clients, availableClientOrganizations, projects, activities, team, approvals, invoices, invoiceableEntries, organizationProfile] = await Promise.all([
    section === 'clients' ? Promise.resolve([]) : listClients(organizationId),
    listAvailableClientOrganizations(
      organizationId,
      session.user.id,
      session.user.role === 'admin'
    ),
    section === 'projects' ? Promise.resolve([]) : listProjects(organizationId),
    section === 'activities' ? Promise.resolve([]) : listActivities(organizationId),
    listTeam(organizationId),
    listApprovalQueue(organizationId),
    section === 'invoices' || !settings.invoicingEnabled ? Promise.resolve([]) : listInvoices(organizationId),
    settings.invoicingEnabled ? listInvoiceableEntries(organizationId) : Promise.resolve([]),
    getOrganizationInvoiceProfile(organizationId)
  ])
  return {
    settings: {
      currency: settings.currency,
      timezone: settings.timezone,
      defaultVatRateBasisPoints: settings.defaultVatRateBasisPoints,
      weekStartsOn: settings.weekStartsOn
    },
    clients,
    availableClientOrganizations,
    projects,
    activities,
    team,
    approvals,
    invoices,
    invoiceableEntries,
    organizationProfile
  }
})
