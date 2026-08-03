import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { updateSettings } from '#layers/timesheets/server/utils/timesheet-repository'
import { settingsUpdateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminSettingsPatch',
    summary: 'Update timesheets workspace settings',
    description: 'Update timesheets workspace settings. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  return updateSettings(organizationId, settingsUpdateSchema.parse(await readBody(event)))
})
