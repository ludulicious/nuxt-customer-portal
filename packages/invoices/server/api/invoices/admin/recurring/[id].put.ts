import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '../../../../../shared/feature'
import { saveRecurringInvoice } from '../../../../utils/recurring-invoices'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing recurring invoice ID' })
  }
  return saveRecurringInvoice(organizationId, session.user.id, await readBody(event), id)
})
