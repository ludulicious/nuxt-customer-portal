import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { changeInvoiceStatus, updateInvoice } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { invoiceIssueSchema, invoiceUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdPatch',
    summary: 'Update an invoice',
    description: 'Update an invoice. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const body = await readBody(event)
  const id = getRouterParam(event, 'id')!
  if ('action' in body) {
    const action = invoiceIssueSchema.parse(body).action
    if (action === 'ISSUE') throw createError({ statusCode: 405, message: 'Issue invoices through the issue-and-send endpoint' })
    return changeInvoiceStatus(organizationId, session.user.id, id, action)
  }
  return updateInvoice(organizationId, session.user.id, id, invoiceUpdateSchema.parse(body))
})
