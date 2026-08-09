import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { createOrganizationContact } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { contactCreateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminOrganizationsByOrganizationIdContactsPost',
    summary: 'Create an invoice contact',
    description: 'Create an invoice contact. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return createOrganizationContact(organizationId, getRouterParam(event, 'organizationId')!, contactCreateSchema.parse(await readBody(event)))
})
