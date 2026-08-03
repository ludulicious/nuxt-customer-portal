import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { deliverInvoiceEmail } from '#layers/timesheets/server/utils/invoice-email'
import { invoiceEmailDeliverySchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdEmailPost',
    summary: 'Send an invoice email',
    description: 'Send an invoice email. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return deliverInvoiceEmail(organizationId, session.user.id, getRouterParam(event, 'id')!, invoiceEmailDeliverySchema.parse(await readBody(event)), false)
})
