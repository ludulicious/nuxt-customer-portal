import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { retrievePortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { normalizeEmailProviderEvent } from '@nuxt-customer-portal/invoices/shared/email-delivery-status'
import type { InvoiceEmailStatusRefreshDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import { invoice, invoiceEmailDelivery } from '@nuxt-customer-portal/invoices/server/db/schema/invoices'
import { getInvoice } from './invoice-repository'

const STATUS_CACHE_MS = 60_000

export const refreshInvoiceEmailStatuses = async (
  organizationId: string,
  invoiceId: string,
  forceRefresh = false
): Promise<InvoiceEmailStatusRefreshDto> => {
  await getInvoice(organizationId, invoiceId)
  const deliveries = await db
    .select({ delivery: invoiceEmailDelivery })
    .from(invoiceEmailDelivery)
    .innerJoin(invoice, eq(invoice.id, invoiceEmailDelivery.invoiceId))
    .where(
      and(
        eq(invoice.organizationId, organizationId),
        eq(invoiceEmailDelivery.invoiceId, invoiceId),
        isNotNull(invoiceEmailDelivery.providerMessageId)
      )
    )
  const failures: InvoiceEmailStatusRefreshDto['failures'] = []
  const staleBefore = Date.now() - STATUS_CACHE_MS

  await Promise.all(
    deliveries.map(async ({ delivery }) => {
      if (
        !forceRefresh &&
        delivery.providerStatusCheckedAt &&
        delivery.providerStatusCheckedAt.getTime() > staleBefore
      ) {
        return
      }
      try {
        const providerEmail = await retrievePortalEmail(delivery.providerMessageId!)
        const checkedAt = new Date()
        await db
          .update(invoiceEmailDelivery)
          .set({
            providerLastEvent: providerEmail.last_event ? normalizeEmailProviderEvent(providerEmail.last_event) : null,
            providerStatusCheckedAt: checkedAt
          })
          .where(eq(invoiceEmailDelivery.id, delivery.id))
      } catch (error) {
        failures.push({
          deliveryId: delivery.id,
          code:
            error instanceof Error && error.message.includes('not configured')
              ? 'PROVIDER_NOT_CONFIGURED'
              : 'PROVIDER_LOOKUP_FAILED'
        })
      }
    })
  )

  const refreshed = await getInvoice(organizationId, invoiceId)
  return { deliveries: refreshed.emailDeliveries ?? [], failures }
}
