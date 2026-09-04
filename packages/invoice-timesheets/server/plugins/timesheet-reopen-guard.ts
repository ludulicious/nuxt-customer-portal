import { registerTimeEntryReopenGuard } from '@nuxt-customer-portal/core/server/utils/business-hooks'
import { hasActiveInvoiceSource } from '@nuxt-customer-portal/invoice-timesheets/server/utils/invoice-timesheets'

export default defineNitroPlugin(() =>
  registerTimeEntryReopenGuard(async (organizationId, entryIds) => {
    if (await hasActiveInvoiceSource(organizationId, entryIds)) {
      throw createError({
        statusCode: 409,
        message: 'Invoiced timesheets cannot be reopened',
        data: { code: 'TIMESHEET_INVOICED' }
      })
    }
  })
)
