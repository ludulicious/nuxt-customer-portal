import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateOrganizationContact } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { contactUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

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
