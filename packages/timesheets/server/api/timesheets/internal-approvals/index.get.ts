import { requireActiveOrganizationRole, listPortalOrganizationMembers } from '@nuxt-customer-portal/core/server/portal'
import {
  ensureSettings,
  listActivities,
  listInternalApprovalMembers,
  listApprovalQueue,
  listClients,
  listProjects
} from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const [settings, approvals, clients, projects, activities, teamMembers] = await Promise.all([
    ensureSettings(organizationId),
    getQuery(event).contextOnly === 'true' ? Promise.resolve([]) : listApprovalQueue(organizationId, session.user.id),
    listClients(organizationId),
    listProjects(organizationId),
    listActivities(organizationId),
    ['owner', 'admin'].includes(role)
      ? listPortalOrganizationMembers(organizationId)
      : listInternalApprovalMembers(organizationId, session.user.id)
  ])
  return {
    settings: {
      currency: settings.currency,
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
      internalApprovalsEnabled: settings.internalApprovalsEnabled
    },
    approvals,
    teamMembers,
    clients,
    projects,
    activities
  }
})
