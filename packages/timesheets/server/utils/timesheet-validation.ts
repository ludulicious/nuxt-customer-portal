import { z } from 'zod'

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
  status: z.enum(['ALL', 'ACTIVE', 'ARCHIVED']).optional(),
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
export const clientApprovalListQuerySchema = z.object({
  ...listBase,
  userId: id.optional(),
  workspaceClientId: id.optional(),
  status: z.enum(['PENDING', 'APPROVED', 'DISPUTED']).optional(),
  sortBy: z.enum(['weekStartsOn', 'supplierName', 'person', 'status', 'totalMinutes']).default('weekStartsOn'),
  sortDir: z.enum(['asc', 'desc']).default('desc')
})
export const internalApprovalListQuerySchema = z.object({
  ...listBase,
  userId: id.optional(),
  status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  sortBy: z.enum(['weekStartsOn', 'userName', 'status', 'totalMinutes']).default('weekStartsOn'),
  sortDir: z.enum(['asc', 'desc']).default('desc')
})
export type InternalApprovalListQuery = z.infer<typeof internalApprovalListQuerySchema>
export const clientSupplierTimesheetListQuerySchema = z.object({
  ...listBase,
  workspaceClientId: id.optional(),
  sortBy: z.enum(['weekStartsOn', 'supplierName', 'person', 'totalMinutes']).default('weekStartsOn'),
  sortDir: z.enum(['asc', 'desc']).default('desc')
})

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>
export type ClientListQuery = z.infer<typeof clientListQuerySchema>
export type ActivityListQuery = z.infer<typeof activityListQuerySchema>
export type ClientApprovalListQuery = z.infer<typeof clientApprovalListQuerySchema>
export type ClientSupplierTimesheetListQuery = z.infer<typeof clientSupplierTimesheetListQuerySchema>

export const weekQuerySchema = z.object({
  week: isoDate.optional()
})

export const entryCreateSchema = z.object({
  projectId: id,
  activityTypeId: id,
  entryDate: isoDate,
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  note: z.string().trim().max(2000).nullable().optional()
})

export const entryUpdateSchema = entryCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const timerStartSchema = z.object({
  projectId: id,
  activityTypeId: id,
  entryDate: isoDate,
  note: z.string().trim().max(2000).nullable().optional()
})

export const clientCreateSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('link'), organizationId: id }),
  z.object({
    mode: z.literal('create'),
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
])

export const clientDeleteSchema = z.object({ clientName: z.string().min(1).max(160) })
export const clientAccessUpdateSchema = z.object({ accessMode: z.enum(['DISABLED', 'VIEW', 'REVIEW']) })
export const organizationCapabilitiesUpdateSchema = z.object({
  workspaceEnabled: z.boolean()
})
export const clientReviewerUpdateSchema = z.object({ userId: id, assigned: z.boolean() })
export const clientReviewSchema = z
  .object({
    action: z.enum(['APPROVE', 'DISPUTE']),
    expectedVersion: z.number().int().min(1),
    comment: z.string().trim().max(2000).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.action === 'DISPUTE' && !value.comment) {
      context.addIssue({ code: 'custom', path: ['comment'], message: 'A dispute comment is required' })
    }
  })

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

export const projectCreateSchema = projectSchema.refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
  message: 'End date must not precede start date',
  path: ['endsOn']
})

export const projectUpdateSchema = projectSchema
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
    personRates: z.record(id, moneyMinor).optional()
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
    message: 'End date must not precede start date',
    path: ['endsOn']
  })

export const hasInvalidProjectActivityAssignments = (
  requestedIds: string[],
  activities: Array<{ id: string; active: boolean }>,
  existingIds: string[] = []
) => {
  const existing = new Set(existingIds)
  return requestedIds.some((id) => {
    const activity = activities.find((item) => item.id === id)
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

export const teamMemberSettingsUpdateSchema = z.object({
  canEnterTime: z.boolean(),
  defaultHourlyRateMinor: moneyMinor.nullable()
})

export const internalApprovalWorkspaceUpdateSchema = z.object({ enabled: z.boolean() })

export const internalApprovalMemberUpdateSchema = z.object({
  required: z.boolean(),
  approverUserIds: z.array(id).max(100)
})

export const settingsUpdateSchema = z.object({
  timerRoundingMinutes: z.number().int().min(1).max(60).optional(),
  currency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  timezone: z.string().min(3).max(100).optional()
})

export const reviewSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'REOPEN']),
    comment: z.string().trim().max(2000).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.action === 'REJECT' && !value.comment) {
      context.addIssue({ code: 'custom', path: ['comment'], message: 'A rejection comment is required' })
    }
  })

export const submissionCreateSchema = z.object({
  cutoffDate: isoDate,
  comment: z.string().trim().max(2000).optional()
})

export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  clientOrganizationId: id.optional(),
  projectId: id.optional(),
  userId: id.optional(),
  activityTypeId: id.optional(),
  billable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional()
})

export type ReportQuery = z.infer<typeof reportQuerySchema>
