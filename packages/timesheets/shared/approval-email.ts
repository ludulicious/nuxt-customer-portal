import { z } from 'zod'

export const approvalEmailResendSchema = z.object({
  clientOrganizationId: z.string().min(1).optional(),
  version: z.number().int().positive(),
  message: z.string().trim().min(1).max(50000),
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

// Keep recipient_name dynamic when a single edited draft targets multiple approvers.
export const fillApprovalEmailDraft = (body: string, values: Record<string, string>) =>
  body.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (token, key: string) =>
    key in values
      ? values[key]!.replace(
          /[&<>"']/g,
          (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
        )
      : token
  )
