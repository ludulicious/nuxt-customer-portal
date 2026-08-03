import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { deleteEntry } from '#layers/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsEntriesByIdDelete',
    summary: 'Delete a time entry',
    description: 'Delete a time entry. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'update'
  )
  await deleteEntry(organizationId, session.user.id, getRouterParam(event, 'id')!)
  return { success: true }
})
