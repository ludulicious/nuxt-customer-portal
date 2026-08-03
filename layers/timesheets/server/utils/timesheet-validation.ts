import { z } from 'zod'
import { hasNumericInvoiceSequence } from '../../shared/invoice-number'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.string().min(1).max(128)
const moneyMinor = z.number().int().min(0).max(2_000_000_000)
const listBase = {
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortDir: z.enum(['asc', 'desc']).default('asc')
}

export const projectListQuerySchema = z.object({
  ...listBase,
  clientOrganizationId: id.optional(),
  sortBy: z.enum(['name', 'clientName', 'startsOn']).default('name')
})
export const clientListQuerySchema = z.object({
  ...listBase,
  configured: z.enum(['configured', 'incomplete']).optional(),
  sortBy: z.enum(['name']).default('name')
})
export const activityListQuerySchema = z.object({
  ...listBase,
  active: z.enum(['true', 'false']).optional(),
  billable: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['name', 'active', 'billable']).default('name')
})
export const invoiceListQuerySchema = z.object({
  ...listBase,
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'VOID']).optional(),
  clientOrganizationId: id.optional(),
  overdue: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['issueDate', 'dueDate', 'number', 'totalMinor']).default('issueDate'),
  sortDir: z.enum(['asc', 'desc']).default('desc')
})

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>
export type ClientListQuery = z.infer<typeof clientListQuerySchema>
export type ActivityListQuery = z.infer<typeof activityListQuerySchema>
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>

export const weekQuerySchema = z.object({
  week: isoDate.optional()
})

export const entryCreateSchema = z.object({
  projectId: id,
  activityTypeId: id,
  entryDate: isoDate,
  durationMinutes: z.number().int().min(1).max(24 * 60),
  note: z.string().trim().max(2000).nullable().optional()
})

export const entryUpdateSchema = entryCreateSchema.partial().refine(
  value => Object.keys(value).length > 0,
  'At least one field is required'
)

export const timerStartSchema = z.object({
  projectId: id,
  activityTypeId: id,
  entryDate: isoDate,
  note: z.string().trim().max(2000).nullable().optional()
})

export const clientCreateSchema = z.object({ organizationId: id })

export const clientDeleteSchema = z.object({ clientName: z.string().min(1).max(160) })

export const organizationProfileUpdateSchema = z.object({
  address: z.string().trim().max(1000), registrationNumber: z.string().trim().max(200).nullable().optional(),
  vatNumber: z.string().trim().max(100).nullable().optional(), iban: z.string().trim().max(100).nullable().optional(),
  bic: z.string().trim().max(100).nullable().optional(), invoiceEmail: z.string().email().max(320).nullable().optional(),
  preferredLocale: z.enum(['nl', 'en']).default('nl')
})
export const contactCreateSchema = z.object({
  userId: id.nullable().optional(), name: z.string().trim().min(1).max(200), email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(80).nullable().optional(), jobTitle: z.string().trim().max(160).nullable().optional()
})
export const contactUpdateSchema = contactCreateSchema.partial().refine(value => Object.keys(value).length > 0, 'At least one field is required')

export const activityCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  billable: z.boolean().default(true)
})

export const activityUpdateSchema = activityCreateSchema.partial().extend({
  active: z.boolean().optional()
})

export const activityDeleteSchema = z.object({
  activityName: z.string().min(1).max(120)
})

const projectSchema = z.object({
  clientOrganizationId: id,
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(40).nullable().optional(),
  startsOn: isoDate.nullable().optional(),
  endsOn: isoDate.nullable().optional(),
  budgetMinutes: z.number().int().positive().nullable().optional(),
  budgetMinor: moneyMinor.positive().nullable().optional(),
  activityTypeIds: z.array(id).min(1)
})

export const projectCreateSchema = projectSchema.refine(v => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
  message: 'End date must not precede start date',
  path: ['endsOn']
})

export const projectUpdateSchema = projectSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  personRates: z.record(id, moneyMinor).optional()
}).refine(v => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
  message: 'End date must not precede start date',
  path: ['endsOn']
})

export const hasInvalidProjectActivityAssignments = (
  requestedIds: string[],
  activities: Array<{ id: string, active: boolean }>,
  existingIds: string[] = []
) => {
  const existing = new Set(existingIds)
  return requestedIds.some((id) => {
    const activity = activities.find(item => item.id === id)
    return !activity || (!activity.active && !existing.has(id))
  })
}

export const projectDeleteSchema = z.object({
  projectName: z.string().min(1).max(160)
})

export const tariffUpdateSchema = z.object({
  userId: id,
  hourlyRateMinor: moneyMinor
})

export const settingsUpdateSchema = z.object({
  currency: z.string().length(3).transform(v => v.toUpperCase()).optional(),
  timezone: z.string().min(3).max(100).optional(),
  defaultVatRateBasisPoints: z.number().int().min(0).max(10_000).optional()
})

export const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REOPEN']),
  comment: z.string().trim().max(2000).nullable().optional()
}).superRefine((value, context) => {
  if (value.action === 'REJECT' && !value.comment) {
    context.addIssue({ code: 'custom', path: ['comment'], message: 'A rejection comment is required' })
  }
})

export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  clientOrganizationId: id.optional(),
  projectId: id.optional(),
  userId: id.optional(),
  activityTypeId: id.optional(),
  billable: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional()
})

export type ReportQuery = z.infer<typeof reportQuerySchema>

const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(500), quantityMilli: z.number().int().positive().max(100_000_000),
  unit: z.string().trim().min(1).max(30).default('hour'), unitPriceMinor: moneyMinor,
  vatRateBasisPoints: z.number().int().min(0).max(10_000).default(2100), timeEntryIds: z.array(id).optional()
})
const invoiceNumber = z.string().trim().min(1).max(60)
  .refine(hasNumericInvoiceSequence, 'Invoice number must end with a numeric sequence')
export const invoiceCreateSchema = z.object({
  clientOrganizationId: id, contactId: id.nullable().optional(), number: invoiceNumber, currency: z.string().length(3),
  issueDate: isoDate, dueDate: isoDate, subject: z.string().trim().max(500).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(),
  lines: z.array(invoiceLineSchema).min(1).max(500)
}).refine(v => v.dueDate >= v.issueDate, { path: ['dueDate'], message: 'Due date must not precede invoice date' })
export const invoiceIssueSchema = z.object({ action: z.enum(['ISSUE', 'VOID', 'UNVOID']) })
export const invoiceUpdateSchema = z.object({
  number: invoiceNumber,
  issueDate: isoDate,
  dueDate: isoDate,
  subject: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).refine(value => value.dueDate >= value.issueDate, { path: ['dueDate'], message: 'Due date must not precede invoice date' })
export const invoicePaymentSchema = z.object({ paidOn: isoDate, amountMinor: moneyMinor.positive(), reference: z.string().trim().max(200).nullable().optional(), note: z.string().trim().max(1000).nullable().optional() })
export const invoiceEmailDeliverySchema = z.object({
  to: z.string().trim().toLowerCase().email().max(320),
  cc: z.array(z.string().trim().toLowerCase().email().max(320)).max(20).default([]),
  locale: z.enum(['nl', 'en']),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(10_000)
}).transform(value => ({ ...value, cc: [...new Set(value.cc.filter(email => email !== value.to))] }))
