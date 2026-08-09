import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { deliverInvoiceEmail } from '@nuxt-customer-portal/timesheets/server/utils/invoice-email'
import { invoiceEmailDeliverySchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdIssuePost',
    summary: 'Issue an invoice',
    description: 'Issue an invoice. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return deliverInvoiceEmail(organizationId, session.user.id, getRouterParam(event, 'id')!, invoiceEmailDeliverySchema.parse(await readBody(event)), true)
})
