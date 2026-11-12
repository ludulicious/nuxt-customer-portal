import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '../../../../../shared/feature'
import { saveRecurringInvoice } from '../../../../utils/recurring-invoices'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  return saveRecurringInvoice(organizationId, session.user.id, await readBody(event))
})
