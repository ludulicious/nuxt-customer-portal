import { z } from 'zod'
import { hasNumericInvoiceSequence } from '@nuxt-customer-portal/invoices/shared/invoice-number'

const id = z.string().trim().min(1).max(200)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const moneyMinor = z.number().int().min(0).max(1_000_000_000)
const invoiceNumber = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine(hasNumericInvoiceSequence, 'Invoice number must end with a numeric sequence')
export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantityMilli: z.number().int().positive().max(100_000_000),
  unit: z.string().trim().min(1).max(30).default('item'),
  unitPriceMinor: moneyMinor,
  vatRateBasisPoints: z.number().int().min(0).max(10_000).default(2100)
})
export const invoiceCreateSchema = z
  .object({
    clientOrganizationId: id,
    contactId: id.nullable().optional(),
    number: invoiceNumber,
    currency: z.string().length(3),
    issueDate: isoDate,
    dueDate: isoDate,
    subject: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    lines: z.array(invoiceLineSchema).min(1).max(500)
  })
  .refine((value) => value.dueDate >= value.issueDate, {
    path: ['dueDate'],
    message: 'Due date must not precede invoice date'
  })
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>
export const invoiceUpdateSchema = z
  .object({
    number: invoiceNumber,
    issueDate: isoDate,
    dueDate: isoDate,
    subject: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional()
  })
  .refine((value) => value.dueDate >= value.issueDate, {
    path: ['dueDate'],
    message: 'Due date must not precede invoice date'
  })
export const invoiceIssueSchema = z.object({ action: z.enum(['VOID', 'UNVOID']) })
export const invoicePaymentSchema = z.object({
  paidOn: isoDate,
  amountMinor: moneyMinor.positive(),
  reference: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional()
})
export const invoiceEmailDeliverySchema = z
  .object({
    to: z.string().trim().toLowerCase().email().max(320),
    cc: z.array(z.string().trim().toLowerCase().email().max(320)).max(20).default([]),
    locale: z.enum(['nl', 'en']),
    subject: z.string().trim().min(1).max(500),
    body: z.string().trim().min(1).max(10_000)
  })
  .transform((value) => ({ ...value, cc: [...new Set(value.cc.filter((email) => email !== value.to))] }))
export const invoiceSettingsSchema = z.object({
  enabled: z.boolean(),
  currency: z.string().trim().toUpperCase().length(3),
  defaultVatRateBasisPoints: z.number().int().min(0).max(10_000),
  address: z.string().trim().max(5000),
  registrationNumber: z.string().trim().max(200).nullable(),
  vatNumber: z.string().trim().max(200).nullable(),
  iban: z.string().trim().max(100).nullable(),
  bic: z.string().trim().max(100).nullable(),
  invoiceEmail: z.string().trim().email().max(320).nullable(),
  preferredLocale: z.enum(['nl', 'en'])
})
export const billingContactCreateSchema = z.object({
  userId: id.nullable().optional(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(80).nullable().optional(),
  jobTitle: z.string().trim().max(160).nullable().optional()
})
export const billingContactUpdateSchema = billingContactCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
const listBase = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortDir: z.enum(['asc', 'desc']).default('desc')
})
export const invoiceListQuerySchema = listBase.extend({
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'VOID']).optional(),
  clientOrganizationId: id.optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sortBy: z.enum(['issueDate', 'dueDate', 'number', 'totalMinor']).default('issueDate')
})
export const clientInvoiceListQuerySchema = listBase.extend({
  status: z.enum(['ISSUED', 'PAID']).optional(),
  accessId: id.optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sortBy: z.enum(['issueDate', 'dueDate', 'number', 'totalMinor']).default('issueDate')
})
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>
export type ClientInvoiceListQuery = z.infer<typeof clientInvoiceListQuerySchema>
