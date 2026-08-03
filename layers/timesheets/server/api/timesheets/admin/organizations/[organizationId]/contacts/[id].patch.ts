import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { updateOrganizationContact } from '#layers/timesheets/server/utils/timesheet-repository'
import { contactUpdateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminOrganizationsByOrganizationIdContactsByIdPatch',
    summary: 'Update an invoice contact',
    description: 'Update an invoice contact. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return updateOrganizationContact(organizationId, getRouterParam(event, 'organizationId')!, getRouterParam(event, 'id')!, contactUpdateSchema.parse(await readBody(event)))
})
