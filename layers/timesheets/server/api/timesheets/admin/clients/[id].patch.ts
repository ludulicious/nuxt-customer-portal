import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { updateClientAccess } from '#layers/timesheets/server/utils/timesheet-repository'
import { clientAccessUpdateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return updateClientAccess(organizationId, getRouterParam(event, 'id')!, clientAccessUpdateSchema.parse(await readBody(event)).accessMode)
})
