import { z } from 'zod'

export const privateClientInvitationSchema = z
  .object({
    requestId: z.uuid(),
    clientId: z.string().min(1).optional(),
    name: z.string().trim().min(2).max(160).optional(),
    email: z.string().trim().toLowerCase().email(),
    preferredLocale: z.enum(['en', 'nl']).default('en')
  })
  .refine((value) => Boolean(value.clientId || value.name), { message: 'Choose a client or enter a name' })
