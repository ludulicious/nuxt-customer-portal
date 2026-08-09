import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { deleteOrganizationContact } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminOrganizationsByOrganizationIdContactsByIdDelete',
    summary: 'Delete an invoice contact',
    description: 'Delete an invoice contact. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return deleteOrganizationContact(organizationId, getRouterParam(event, 'organizationId')!, getRouterParam(event, 'id')!)
})
