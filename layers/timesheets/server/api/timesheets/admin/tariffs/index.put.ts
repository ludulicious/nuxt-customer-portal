import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { setTeamTariff } from '#layers/timesheets/server/utils/timesheet-repository'
import { tariffUpdateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminTariffsPut',
    summary: 'Update team billing rates',
    description: 'Update team billing rates. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  const input = tariffUpdateSchema.parse(await readBody(event))
  return setTeamTariff(organizationId, input.userId, input.hourlyRateMinor)
})
