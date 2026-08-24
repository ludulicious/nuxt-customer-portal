import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { setTeamTariff } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { tariffUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminTariffsPut',
    summary: 'Update team billing rates',
    description:
      'Update team billing rates. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const input = tariffUpdateSchema.parse(await readBody(event))
  return setTeamTariff(organizationId, input.userId, input.hourlyRateMinor)
})
