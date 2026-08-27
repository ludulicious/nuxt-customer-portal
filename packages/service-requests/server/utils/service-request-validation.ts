import { z } from 'zod'

export const serviceRequestStatuses = [
  'NEW', 'EVALUATING', 'AWAITING_APPROVAL', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED'
] as const
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional()
const details = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10_000),
  contactName: optionalText(200),
  contactEmail: z.union([z.string().trim().email().max(320), z.literal('')]).optional(),
  contactPhone: optionalText(80),
  requestedDate: z.iso.date().optional(),
  serviceLocation: optionalText(500),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: optionalText(100)
}
export const createServiceRequestSchema = z.object({ clientOrganizationId: optionalText(128), ...details })
export const updateServiceRequestSchema = z.object(details).partial()
export const adminUpdateServiceRequestSchema = updateServiceRequestSchema.extend({
  status: z.enum(serviceRequestStatuses).optional(),
  assignedToId: z.string().trim().min(1).nullable().optional(),
  internalNotes: z.string().trim().max(10_000).optional()
})
export const serviceRequestCommentSchema = z.object({ body: z.string().trim().min(1).max(5000) })
export const serviceRequestQuoteLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantityMilli: z.number().int().positive().max(1_000_000_000),
  unit: z.string().trim().min(1).max(30),
  unitPriceMinor: z.number().int().min(0).max(1_000_000_000),
  vatRateBasisPoints: z.number().int().min(0).max(10_000)
})
export const serviceRequestQuoteCreateSchema = z.object({
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  validUntil: z.iso.date(),
  notes: z.string().trim().max(5000).optional(),
  lines: z.array(serviceRequestQuoteLineSchema).min(1).max(100)
})
export const serviceRequestQuoteDecisionSchema = z.object({ action: z.enum(['accept', 'decline']) })
export const filterServiceRequestSchema = z.object({
  clientOrganizationId: optionalText(128),
  status: z.enum(serviceRequestStatuses).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: optionalText(100),
  assignedToId: optionalText(128),
  createdById: optionalText(128),
  search: optionalText(200),
  sortBy: z.enum(['createdAt', 'requestedDate', 'status', 'priority']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  take: z.coerce.number().int().positive().max(100).optional()
}).transform((value) => {
  const pageSize = value.pageSize ?? value.take ?? 20
  const page = value.page ?? (value.skip === undefined ? 1 : Math.floor(value.skip / pageSize) + 1)
  return { ...value, page, pageSize, offset: (page - 1) * pageSize }
})

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>
export type AdminUpdateServiceRequestInput = z.infer<typeof adminUpdateServiceRequestSchema>
export type ServiceRequestQuery = z.output<typeof filterServiceRequestSchema>
