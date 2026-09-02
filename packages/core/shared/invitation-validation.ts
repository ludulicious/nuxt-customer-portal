import { z } from 'zod'

export const invitationRoleSchema = z.object({ role: z.enum(['member', 'admin', 'owner']) }).strict()
export type InvitationRole = z.infer<typeof invitationRoleSchema>['role']
export const invitationChangeSchema = z.union([
  invitationRoleSchema,
  z.object({ status: z.literal('canceled') }).strict()
])
