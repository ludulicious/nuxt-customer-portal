import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateClientAccess } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { clientAccessUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const body = await readBody(event)
  return updateClientAccess(
    organizationId,
    getRouterParam(event, 'id')!,
    clientAccessUpdateSchema.parse(body).accessMode
  )
})
