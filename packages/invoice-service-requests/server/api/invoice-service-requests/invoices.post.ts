import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { createInvoiceFromServiceRequest } from '@nuxt-customer-portal/invoice-service-requests/server/utils/invoice-service-requests'
import { serviceRequestInvoiceCreateSchema } from '@nuxt-customer-portal/invoice-service-requests/shared/validation'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return createInvoiceFromServiceRequest(organizationId, session.user.id, serviceRequestInvoiceCreateSchema.parse(await readBody(event)))
})
