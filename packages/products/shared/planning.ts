import { z } from 'zod'

export const planningPolicySchema = z.object({
  reservationMinutes: z.number().int().min(30).max(1440).default(60),
  slotIntervalMinutes: z.number().int().min(5).max(120).default(15),
  bookingHorizonDays: z.number().int().min(1).max(365).default(90),
  minimumNoticeMinutes: z.number().int().min(0).max(525600).default(1440),
  freeChanges: z.number().int().min(0).max(100).default(1),
  changeFees: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().int().positive().max(100000000)).default({}),
  rescheduleCutoffMinutes: z.number().int().min(0).max(525600).default(1440),
  cancellationEnabled: z.boolean().default(false),
  cancellationCutoffMinutes: z.number().int().min(0).max(525600).default(1440),
  refundPercentage: z.number().int().min(0).max(100).default(100)
})
export type PlanningPolicy = z.infer<typeof planningPolicySchema>
export const productPlanningSchema = z
  .object({
    enabled: z.boolean().default(false),
    durationMinutes: z.number().int().min(1).max(1440).nullable().default(null),
    providerUserIds: z.array(z.string().min(1).max(100)).max(100).default([]),
    meetingProvider: z.enum(['none', 'zoom']).default('none'),
    policyOverrides: planningPolicySchema.partial().default({})
  })
  .superRefine((value, ctx) => {
    if (value.enabled && !value.durationMinutes) {
      ctx.addIssue({ code: 'custom', path: ['durationMinutes'], message: 'A positive duration is required' })
    }
    if (new Set(value.providerUserIds).size !== value.providerUserIds.length) {
      ctx.addIssue({ code: 'custom', path: ['providerUserIds'], message: 'Select each provider once' })
    }
    if (value.enabled && !value.providerUserIds.length) {
      ctx.addIssue({ code: 'custom', path: ['providerUserIds'], message: 'Select at least one provider' })
    }
  })
export type ProductPlanning = z.infer<typeof productPlanningSchema>
export const defaultPlanning = (): ProductPlanning => productPlanningSchema.parse({})
export const defaultPlanningPolicy = (): PlanningPolicy => planningPolicySchema.parse({})
export const effectivePolicy = (defaults: PlanningPolicy, overrides: Partial<PlanningPolicy> = {}) =>
  planningPolicySchema.parse({ ...defaults, ...overrides })
