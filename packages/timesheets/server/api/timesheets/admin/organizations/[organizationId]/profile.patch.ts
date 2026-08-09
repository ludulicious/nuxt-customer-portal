import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateOrganizationInvoiceProfile } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { organizationProfileUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminOrganizationsByOrganizationIdProfilePatch',
    summary: 'Update a client invoice profile',
    description: 'Update a client invoice profile. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return updateOrganizationInvoiceProfile(organizationId, getRouterParam(event, 'organizationId')!, organizationProfileUpdateSchema.parse(await readBody(event)))
})
