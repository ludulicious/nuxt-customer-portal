import { z } from 'zod'

const color = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6})?$/)
  .default('')
export const markdownStyleSchema = z.object({
  fontFamily: z.enum(['system', 'serif', 'sans']).default('system'),
  fontSize: z.number().int().min(12).max(24).default(16),
  lineHeight: z.number().min(1.2).max(2.4).default(1.7),
  paragraphSpacing: z.number().min(0.5).max(2).default(1),
  headingScale: z.number().min(1).max(1.6).default(1.25),
  bulletStyle: z.enum(['disc', 'circle', 'square', 'dash', 'check', 'sparkle']).default('disc'),
  bulletColor: color,
  textColor: color,
  headingColor: color,
  linkColor: color,
  backgroundColor: color
})
export type MarkdownStyle = z.infer<typeof markdownStyleSchema>
export const defaultMarkdownStyle = () => markdownStyleSchema.parse({})
