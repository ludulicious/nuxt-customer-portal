import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { deleteClient } from '#layers/timesheets/server/utils/timesheet-repository'
import { clientDeleteSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminClientsByIdDelete',
    summary: 'Remove a timesheet client',
    description: 'Remove a timesheet client. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const input = clientDeleteSchema.parse(await readBody(event))
  return deleteClient(organizationId, getRouterParam(event, 'id')!, input.clientName)
})
