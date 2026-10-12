import { z } from 'zod'

export const approvalEmailResendSchema = z.object({
  clientOrganizationId: z.string().min(1).optional(),
  version: z.number().int().positive(),
  message: z.string().trim().max(5000),
  requestId: z.uuid(),
  recipients: z
    .array(z.object({ id: z.string().min(1), email: z.email() }))
    .min(1)
    .max(100)
})

export const approvalEmailRecipientsMatch = (
  current: Array<{ id: string; email: string }>,
  expected: Array<{ id: string; email: string }>
) =>
  current.length === expected.length &&
  new Set(expected.map((item) => item.id)).size === expected.length &&
  current.every((recipient) => expected.some((item) => item.id === recipient.id && item.email === recipient.email))
