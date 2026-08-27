import { z } from 'zod'
import { invoiceCreateSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

export const serviceRequestInvoiceCreateSchema = invoiceCreateSchema.extend({ requestId: z.string().trim().min(1), quoteId: z.string().trim().min(1).optional() })
