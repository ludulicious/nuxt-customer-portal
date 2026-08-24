import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/feature'
import { createInvoiceFromTimesheets } from '@nuxt-customer-portal/invoice-timesheets/server/utils/invoice-timesheets'
import { timesheetInvoiceCreateSchema } from '@nuxt-customer-portal/invoice-timesheets/shared/validation'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
    operationId: 'invoiceTimesheetsInvoicesPost',
    summary: 'Create an invoice from Timesheets',
    description: 'Atomically validates approved billable entries, creates an invoice, and links its source entries.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return createInvoiceFromTimesheets(
    organizationId,
    session.user.id,
    timesheetInvoiceCreateSchema.parse(await readBody(event))
  )
})
