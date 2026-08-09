import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateTeamMemberSettings } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { teamMemberSettingsUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminTeamMemberPut',
    summary: 'Update a team member’s Timesheets settings',
    description: 'Update time-entry eligibility and the default hourly rate for an organization member.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const userId = getRouterParam(event, 'userId')
  if (!userId) throw createError({ statusCode: 400, message: 'Team member is required' })
  const input = teamMemberSettingsUpdateSchema.parse(await readBody(event))
  await updateTeamMemberSettings(organizationId, userId, input)
  return { updated: true }
})
