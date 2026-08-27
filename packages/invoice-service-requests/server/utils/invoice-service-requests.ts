import { and, eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { createInvoiceInTransaction, requireInvoicesEnabled } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { serviceRequest, serviceRequestActivity, serviceRequestQuote, serviceRequestQuoteLine } from '@nuxt-customer-portal/service-requests/schema'
import { invoiceServiceRequest } from '@nuxt-customer-portal/invoice-service-requests/schema'
import type { z } from 'zod'
import type { serviceRequestInvoiceCreateSchema } from '@nuxt-customer-portal/invoice-service-requests/shared/validation'

export const createInvoiceFromServiceRequest = async (organizationId: string, actorUserId: string, input: z.infer<typeof serviceRequestInvoiceCreateSchema>) => {
  await requireInvoicesEnabled(organizationId)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invoice-service-request:${input.requestId}`}))`)
    const [request] = await tx.select().from(serviceRequest).where(and(eq(serviceRequest.id, input.requestId), eq(serviceRequest.organizationId, organizationId))).limit(1)
    if (!request || request.clientOrganizationId !== input.clientOrganizationId) {
throw createError({ statusCode: 400, message: 'Request does not belong to this client' })
}
    const [existing] = await tx.select().from(invoiceServiceRequest).where(eq(invoiceServiceRequest.requestId, input.requestId)).limit(1)
    if (existing) {
throw createError({ statusCode: 409, message: 'Request already has an invoice' })
}
    let invoiceInput = input
    if (input.quoteId) {
      const [quote] = await tx.select().from(serviceRequestQuote).where(and(eq(serviceRequestQuote.id, input.quoteId), eq(serviceRequestQuote.requestId, input.requestId))).limit(1)
      if (!quote || quote.status !== 'ACCEPTED' || quote.currency !== input.currency) {
throw createError({ statusCode: 409, message: 'Accepted quote is unavailable' })
}
      const lines = await tx.select().from(serviceRequestQuoteLine).where(eq(serviceRequestQuoteLine.quoteId, quote.id)).orderBy(serviceRequestQuoteLine.position)
      invoiceInput = { ...input, lines: lines.map(({ description, quantityMilli, unit, unitPriceMinor, vatRateBasisPoints }) => ({ description, quantityMilli, unit, unitPriceMinor, vatRateBasisPoints })) }
    } else {
      const quoteCount = await tx.$count(serviceRequestQuote, eq(serviceRequestQuote.requestId, input.requestId))
      if (quoteCount) {
throw createError({ statusCode: 409, message: 'Use the accepted quote to create this invoice' })
}
    }
    const { requestId, quoteId, ...values } = invoiceInput
    const created = await createInvoiceInTransaction(tx, organizationId, actorUserId, values)
    await tx.insert(invoiceServiceRequest).values({ id: nanoid(), requestId, quoteId: quoteId ?? null, invoiceId: created.id })
    await tx.insert(serviceRequestActivity).values({ id: nanoid(), requestId, actorUserId, type: 'INVOICE_CREATED', metadata: JSON.stringify({ invoiceId: created.id, number: created.number }) })
    return created
  })
}
