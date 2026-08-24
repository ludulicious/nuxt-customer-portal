import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/feature'
import { listTimesheetInvoiceSources } from '@nuxt-customer-portal/invoice-timesheets/server/utils/invoice-timesheets'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoiceTimesheetsSourcesGet',
    summary: 'List invoiceable Timesheets entries',
    description:
      'Lists approved, billable, uninvoiced entries when the active provider Timesheets workspace is enabled.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const query = getQuery(event)
  return listTimesheetInvoiceSources(
    organizationId,
    typeof query.from === 'string' ? query.from : undefined,
    typeof query.to === 'string' ? query.to : undefined
  )
})
