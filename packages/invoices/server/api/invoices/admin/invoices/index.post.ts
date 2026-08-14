import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { createInvoice, requireInvoicesEnabled } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { invoiceCreateSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Invoices'],
operationId: 'invoicesAdminInvoicesPost',
    summary: 'Create an invoice',
    description: 'Create an invoice. Scoped to the active organization and the applicable Invoices permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  await requireInvoicesEnabled(organizationId)
  return createInvoice(organizationId, session.user.id, invoiceCreateSchema.parse(await readBody(event)))
})
