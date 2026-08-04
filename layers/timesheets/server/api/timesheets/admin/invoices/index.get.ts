import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { invoiceListQuerySchema } from '#layers/timesheets/server/utils/timesheet-validation'
import { listInvoicesPage } from '#layers/timesheets/server/utils/timesheet-admin-listing'
import { requireInvoicingEnabled } from '#layers/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesGet',
    summary: 'List invoices',
    description: 'List invoices. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  await requireInvoicingEnabled(organizationId)
  return listInvoicesPage(organizationId, invoiceListQuerySchema.parse(getQuery(event)))
})
