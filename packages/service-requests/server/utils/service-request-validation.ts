import { z } from 'zod'

export const createServiceRequestSchema = z.object({
  clientOrganizationId: z.string().min(1).max(128).optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().max(100).optional()
})

export const updateServiceRequestSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().max(100).optional()
})

export const adminUpdateServiceRequestSchema = updateServiceRequestSchema.extend({
  assignedToId: z.string().optional(),
  internalNotes: z.string().max(5000).optional()
})

export const filterServiceRequestSchema = z.object({
  clientOrganizationId: z.string().min(1).max(128).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  assignedToId: z.string().optional(),
  createdById: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'status', 'priority']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  take: z.coerce.number().int().positive().max(100).optional()
}).transform((value) => {
  const pageSize = value.pageSize ?? value.take ?? 20
  const page = value.page ?? (value.skip === undefined ? 1 : Math.floor(value.skip / pageSize) + 1)
  return {
    ...value,
    page,
    pageSize,
    offset: (page - 1) * pageSize
  }
})

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>
export type AdminUpdateServiceRequestInput = z.infer<typeof adminUpdateServiceRequestSchema>
export type ServiceRequestQuery = z.output<typeof filterServiceRequestSchema>
