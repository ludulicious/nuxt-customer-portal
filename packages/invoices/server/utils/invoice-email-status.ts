import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { retrievePortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import {
  normalizeEmailProviderEvent,
  shouldRefreshInvoiceEmailStatus
} from '@nuxt-customer-portal/invoices/shared/email-delivery-status'
import type { InvoiceEmailStatusRefreshDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import { invoice, invoiceEmailDelivery } from '@nuxt-customer-portal/invoices/server/db/schema/invoices'
import { getInvoice } from './invoice-repository'

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
  for (const { delivery } of deliveries) {
    if (!shouldRefreshInvoiceEmailStatus(delivery, forceRefresh)) {
      continue
    }
    // Claim the attempt before calling the provider. Concurrent requests skip it,
    // and failures also observe the cooldown without changing the known status.
    const [claimed] = await db
      .update(invoiceEmailDelivery)
      .set({ providerStatusCheckedAt: new Date() })
      .where(
        and(
          eq(invoiceEmailDelivery.id, delivery.id),
          delivery.providerStatusCheckedAt
            ? eq(invoiceEmailDelivery.providerStatusCheckedAt, delivery.providerStatusCheckedAt)
            : isNull(invoiceEmailDelivery.providerStatusCheckedAt)
        )
      )
      .returning({ id: invoiceEmailDelivery.id })
    if (!claimed) {
      continue
    }
    try {
      const providerEmail = await retrievePortalEmail(delivery.providerMessageId!)
      await db
        .update(invoiceEmailDelivery)
        .set({
          providerLastEvent: providerEmail.last_event
            ? normalizeEmailProviderEvent(providerEmail.last_event)
            : delivery.providerLastEvent
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
  }

  const refreshed = await getInvoice(organizationId, invoiceId)
  return { deliveries: refreshed.emailDeliveries ?? [], failures }
}
