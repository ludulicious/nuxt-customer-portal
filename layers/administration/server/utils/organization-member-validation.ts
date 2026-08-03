import { z } from 'zod'

export const linkOrganizationMemberSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(['owner', 'admin', 'member'])
})

export type LinkOrganizationMemberInput = z.infer<typeof linkOrganizationMemberSchema>
