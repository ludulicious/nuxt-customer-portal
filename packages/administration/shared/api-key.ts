import { z } from 'zod'

export const apiKeySchema = z.object({
  name: z.string().trim().min(1).max(32),
  expiresAt: z.iso.datetime().nullable().default(null),
  scopes: z.array(z.string().regex(/^[a-z][a-z0-9.-]*:[a-z][a-z0-9.-]*$/)).min(1)
})
