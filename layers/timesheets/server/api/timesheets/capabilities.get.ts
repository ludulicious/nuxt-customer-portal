import { eq } from 'drizzle-orm'
import { db, requireActiveOrganizationRole } from '#portal/server/portal'
import { workspaceSettings } from '#layers/timesheets/server/db/schema/timesheets'
import { listClientWorkspaces } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const [settings, clientWorkspaces] = await Promise.all([
    db.select({ workspaceEnabled: workspaceSettings.workspaceEnabled, invoicingEnabled: workspaceSettings.invoicingEnabled }).from(workspaceSettings).where(eq(workspaceSettings.organizationId, organizationId)).limit(1),
    listClientWorkspaces(organizationId, session.user.id, role === 'owner' || role === 'admin' || session.user.role === 'admin')
  ])
  return { canEnterTime: settings[0]?.workspaceEnabled ?? false, canInvoice: settings[0]?.invoicingEnabled ?? false, canViewClientTime: Boolean(clientWorkspaces.length) }
})
