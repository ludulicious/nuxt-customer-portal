import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '#portal/server/portal'
import { EmailProviderRejectedError, retrieveOrganizationEmail } from '#portal/server/utils/organization-email-provider'
import { normalizeEmailProviderEvent } from '#layers/timesheets/shared/email-delivery-status'
import type { InvoiceEmailStatusRefreshDto } from '#layers/timesheets/shared/types/timesheet'
import { invoice, invoiceEmailDelivery } from '#layers/timesheets/server/db/schema/timesheets'
import { getInvoice } from './timesheet-repository'

const STATUS_CACHE_MS = 60_000

export const refreshInvoiceEmailStatuses = async (
  organizationId: string,
  invoiceId: string,
  forceRefresh = false
): Promise<InvoiceEmailStatusRefreshDto> => {
  await getInvoice(organizationId, invoiceId)
  const deliveries = await db.select({ delivery: invoiceEmailDelivery })
    .from(invoiceEmailDelivery)
    .innerJoin(invoice, eq(invoice.id, invoiceEmailDelivery.invoiceId))
    .where(and(
      eq(invoice.organizationId, organizationId),
      eq(invoiceEmailDelivery.invoiceId, invoiceId),
      isNotNull(invoiceEmailDelivery.providerMessageId)
    ))
  const failures: InvoiceEmailStatusRefreshDto['failures'] = []
  const staleBefore = Date.now() - STATUS_CACHE_MS

  await Promise.all(deliveries.map(async ({ delivery }) => {
    if (!forceRefresh && delivery.providerStatusCheckedAt && delivery.providerStatusCheckedAt.getTime() > staleBefore) return
    try {
      const providerEmail = await retrieveOrganizationEmail(organizationId, delivery.providerMessageId!)
      const checkedAt = new Date()
      await db.update(invoiceEmailDelivery).set({
        providerLastEvent: providerEmail.last_event ? normalizeEmailProviderEvent(providerEmail.last_event) : null,
        providerStatusCheckedAt: checkedAt
      }).where(eq(invoiceEmailDelivery.id, delivery.id))
    } catch (error) {
      failures.push({
        deliveryId: delivery.id,
        code: error instanceof EmailProviderRejectedError && error.reason === 'PROVIDER_NOT_CONFIGURED'
          ? 'PROVIDER_NOT_CONFIGURED'
          : 'PROVIDER_LOOKUP_FAILED'
      })
    }
  }))

  const refreshed = await getInvoice(organizationId, invoiceId)
  return { deliveries: refreshed.emailDeliveries ?? [], failures }
}
