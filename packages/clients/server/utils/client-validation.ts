import { z } from 'zod'

const id = z.string().min(1).max(128)
const slug = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const genericClientListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['all', 'active', 'archived']).optional(),
  moduleId: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'status']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc')
})

export const genericClientCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug,
  officialName: z.string().trim().min(2).max(200),
  address: z.string().trim().max(1000).default(''),
  registrationNumber: z.string().trim().max(200).nullable().optional(),
  vatNumber: z.string().trim().max(100).nullable().optional(),
  invoiceEmail: z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  preferredLocale: z.enum(['nl', 'en']).default('nl'),
  moduleIds: z.array(z.string().trim().min(1).max(100)).max(50).optional()
})

export const clientUpdateSchema = genericClientCreateSchema.omit({ slug: true, moduleIds: true }).partial().refine(value => Object.keys(value).length > 0, 'At least one field is required')
export const clientArchiveSchema = z.object({ archived: z.boolean() })
export const clientModuleUpdateSchema = z.object({ enabled: z.boolean() })
export const genericClientDeleteSchema = z.object({ clientName: z.string().trim().min(1).max(200) })
export const clientIdSchema = id

export type GenericClientListQuery = z.infer<typeof genericClientListQuerySchema>
export type ClientCreateInput = z.infer<typeof genericClientCreateSchema>
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>

export const genericClientInvitationSchema = z.object({
  email: z.email(),
  role: z.enum(['owner', 'admin', 'member']).default('member')
})

export const genericClientMemberUpdateSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']).optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional()
}).refine(value => Object.keys(value).length > 0)
