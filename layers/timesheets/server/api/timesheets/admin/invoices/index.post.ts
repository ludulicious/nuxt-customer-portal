import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { createInvoice } from '#layers/timesheets/server/utils/timesheet-repository'
import { invoiceCreateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

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
  return createInvoice(organizationId, session.user.id, invoiceCreateSchema.parse(await readBody(event)))
})
