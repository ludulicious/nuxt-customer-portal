import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { registerInvoicePayment } from '#layers/timesheets/server/utils/timesheet-repository'
import { invoicePaymentSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdPaymentsPost',
    summary: 'Register an invoice payment',
    description: 'Register an invoice payment. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  return registerInvoicePayment(organizationId, session.user.id, getRouterParam(event, 'id')!, invoicePaymentSchema.parse(await readBody(event)))
})
