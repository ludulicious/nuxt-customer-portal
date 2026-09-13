import { z } from 'zod'
import { isValidTimezone } from '@nuxt-customer-portal/core/shared/timezone'

export { planningPolicySchema } from '@nuxt-customer-portal/products/shared/planning'
export const timezoneSchema = z.string().max(100).refine(isValidTimezone, 'Choose an IANA timezone')
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Invalid date')
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
export const availabilitySchema = z
  .object({
    date,
    endDate: date.nullable().default(null),
    startTime: time,
    endTime: z
      .string()
      .transform((value) => (value === '00:00' ? '24:00' : value))
      .pipe(z.union([time, z.literal('24:00')])),
    recurring: z.boolean().default(false),
    productIds: z.array(z.string().min(1).max(100)).min(1).max(100).nullable().default(null),
    exceptions: z.array(date).max(365).default([])
  })
  .superRefine((v, c) => {
    if (v.endTime <= v.startTime) {
      c.addIssue({ code: 'custom', path: ['endTime'], message: 'End must follow start on the same day' })
    }
    if (v.endDate && v.endDate < v.date) {
      c.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must follow start date' })
    }
  })
export const providerSettingsSchema = z.object({
  timezone: timezoneSchema,
  graceMinutes: z.number().int().min(0).max(1440),
  busyCalendarIds: z.array(z.string().min(1).max(500)).min(1).max(20),
  writeCalendarId: z.string().min(1).max(500)
})
export const availabilityQuerySchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    providerUserId: z.string().max(100).optional()
  })
  .refine(
    (v) => Date.parse(v.to) > Date.parse(v.from) && Date.parse(v.to) - Date.parse(v.from) <= 31 * 86400000,
    'Request at most 31 days'
  )
export const holdSchema = z.object({
  productId: z.string().min(1).max(100),
  providerUserId: z.string().min(1).max(100),
  start: z.iso.datetime({ offset: true }),
  customerTimezone: timezoneSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.enum(['en', 'nl']).default('en'),
  replacesId: z.uuid().optional(),
  previousHoldToken: z.string().min(32).max(200).optional()
})
export const holdCredentialSchema = z.object({ holdToken: z.string().min(32).max(200) })

export const availabilityEditSchema = availabilitySchema.safeExtend({ occurrenceDate: date.optional() })

export const appointmentListSchema = z.object({
  search: z.string().trim().max(200).default(''),
  status: z.enum(['all', 'confirmed', 'cancelled']).default('all'),
  conflicts: z.enum(['all', 'conflicts']).default('all'),
  sortBy: z.enum(['start', 'title']).default('start'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(100000).default(1)
})
export const staffRescheduleSchema = z.object({
  providerUserId: z.string().min(1).max(100),
  start: z.iso.datetime({ offset: true }),
  customerTimezone: timezoneSchema,
  revision: z.number().int().min(0)
})
