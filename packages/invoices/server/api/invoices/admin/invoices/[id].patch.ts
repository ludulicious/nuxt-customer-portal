import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { changeInvoiceStatus, updateInvoice } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { invoiceIssueSchema, invoiceUpdateSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesByIdPatch',
    summary: 'Update an invoice',
    description: 'Update an invoice. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const body = await readBody(event)
  const id = getRouterParam(event, 'id')!
  if ('action' in body) {
    const action = invoiceIssueSchema.parse(body).action
    return changeInvoiceStatus(organizationId, session.user.id, id, action)
  }
  return updateInvoice(organizationId, session.user.id, id, invoiceUpdateSchema.parse(body))
})
