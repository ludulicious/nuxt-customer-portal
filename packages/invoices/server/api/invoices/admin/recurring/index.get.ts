import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '../../../../../shared/feature'
import { requireInvoicesEnabled } from '../../../../utils/invoice-repository'
import { listRecurringInvoices, recurringListQuerySchema } from '../../../../utils/recurring-invoices'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  await requireInvoicesEnabled(organizationId)
  return listRecurringInvoices(organizationId, recurringListQuerySchema.parse(getQuery(event)))
})
