import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import {
  ensureSettings,
  listActivities,
  listApprovalQueue,
  listClients,
  listProjects
} from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireActiveOrganizationRole(event)
  const [settings, approvals, clients, projects, activities] = await Promise.all([
    ensureSettings(organizationId),
    listApprovalQueue(organizationId, session.user.id),
    listClients(organizationId),
    listProjects(organizationId),
    listActivities(organizationId)
  ])
  return {
    settings: {
      currency: settings.currency,
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
      internalApprovalsEnabled: settings.internalApprovalsEnabled
    },
    approvals,
    clients,
    projects,
    activities
  }
})
