import { z } from 'zod'

export const submissionReplySchema = z.object({ reply: z.string().trim().max(5000).optional() })
