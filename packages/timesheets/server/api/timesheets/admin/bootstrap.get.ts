import { db, requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { organization } from '@nuxt-customer-portal/core/schema'
import { eq } from 'drizzle-orm'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import {
  ensureSettings,
  listActivities,
  listAvailableClientOrganizations,
  listClients,
  getTimesheetsSetupStatus,
  listProjects,
  listTeam
} from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminBootstrapGet',
    summary: 'Get timesheets administration data',
    description:
      'Get timesheets administration data. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const section = String(getQuery(event).section ?? '')
  const settings = await ensureSettings(organizationId)
  const [
    providerOrganizations,
    clients,
    availableClientOrganizations,
    projects,
    activities,
    team,
    approvals,
    setupStatus
  ] = await Promise.all([
    db
      .select({ organizationId: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1),
    section === 'clients' ? Promise.resolve([]) : listClients(organizationId),
    listAvailableClientOrganizations(organizationId, session.user.id, session.user.role === 'admin'),
    section === 'projects' ? Promise.resolve([]) : listProjects(organizationId),
    section === 'activities' ? Promise.resolve([]) : listActivities(organizationId),
    listTeam(organizationId),
    Promise.resolve([]),
    getTimesheetsSetupStatus(organizationId)
  ])
  const providerOrganization = providerOrganizations[0]
  if (!providerOrganization) {
    throw createError({ statusCode: 404, message: 'Provider organization not found' })
  }
  return {
    providerOrganization,
    settings: {
      currency: settings.currency,
      timezone: settings.timezone,
      timerRoundingMinutes: settings.timerRoundingMinutes,
      weekStartsOn: settings.weekStartsOn,
      internalApprovalsEnabled: settings.internalApprovalsEnabled
    },
    clients,
    availableClientOrganizations,
    projects,
    activities,
    team,
    approvals,
    setupStatus
  }
})
