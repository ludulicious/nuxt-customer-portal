import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateClientAccess, updateClientInvoiceAccess } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { clientAccessUpdateSchema, clientInvoiceAccessUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const body = await readBody(event)
  if (body && typeof body === 'object' && 'invoiceAccessEnabled' in body) return updateClientInvoiceAccess(organizationId, getRouterParam(event, 'id')!, clientInvoiceAccessUpdateSchema.parse(body).invoiceAccessEnabled)
  return updateClientAccess(organizationId, getRouterParam(event, 'id')!, clientAccessUpdateSchema.parse(body).accessMode)
})
