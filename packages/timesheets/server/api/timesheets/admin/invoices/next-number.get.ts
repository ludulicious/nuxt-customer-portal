import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { getNextInvoiceNumber } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsAdminInvoicesNextNumberGet',
    summary: 'Suggest the next invoice number'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return { number: await getNextInvoiceNumber(organizationId) }
})
