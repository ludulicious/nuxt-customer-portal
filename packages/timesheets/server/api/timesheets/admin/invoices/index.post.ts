import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { createInvoice, requireInvoicingEnabled } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { invoiceCreateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesPost',
    summary: 'Create an invoice',
    description: 'Create an invoice. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  await requireInvoicingEnabled(organizationId)
  return createInvoice(organizationId, session.user.id, invoiceCreateSchema.parse(await readBody(event)))
})
