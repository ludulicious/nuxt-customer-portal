import { z } from 'zod'
import { invoiceCreateSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'

export const timesheetInvoiceCreateSchema = invoiceCreateSchema.safeExtend({
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(500),
        quantityMilli: z.number().int().positive(),
        unit: z.string().trim().min(1).max(30),
        unitPriceMinor: z.number().int().min(0),
        vatRateBasisPoints: z.number().int().min(0).max(10_000),
        timeEntryIds: z.array(z.string().trim().min(1)).min(1)
      })
    )
    .min(1)
    .max(500)
})
