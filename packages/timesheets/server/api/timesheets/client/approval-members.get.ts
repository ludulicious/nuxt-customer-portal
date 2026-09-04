import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { listClientApprovals } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  const approvals = await listClientApprovals(organizationId, session.user.id, isAdmin)
  return [
    ...new Map(approvals.items.map((item) => [item.userId, { id: item.userId, name: item.person }])).values()
  ].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
})
