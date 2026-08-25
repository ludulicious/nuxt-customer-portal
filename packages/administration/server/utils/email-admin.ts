import type { H3Event } from 'h3'
import { z } from 'zod'
import { requireSession } from '@nuxt-customer-portal/core/server'

export const requireEmailAdmin = async (event: H3Event) => {
  const session = await requireSession(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'System administrator access required' })
  }
  return session
}

const text = z.object({
  subject: z.string().max(500),
  body: z.string().max(50_000),
  footer: z.string().max(10_000).optional()
})
export const emailSettingsInput = z.object({
  apiKey: z.string().trim().min(8).max(500).optional(),
  fromName: z.string().trim().max(200),
  fromEmail: z.string().trim().email().max(320),
  defaultLocale: z.enum(['en', 'nl']),
  htmlTemplate: z.string().max(100_000).nullable(),
  textOverrides: z.record(z.string().max(300), text.partial()).default({}),
  definitions: z
    .array(z.object({ moduleId: z.string(), definition: z.any() }))
    .max(100)
    .optional()
})

export const emailProviderInput = emailSettingsInput.pick({
  apiKey: true,
  fromName: true,
  fromEmail: true,
  defaultLocale: true
})

export const emailTemplateInput = emailSettingsInput.pick({ htmlTemplate: true })

export const emailTextsInput = emailSettingsInput.pick({ textOverrides: true, definitions: true })

export const parseEmailAdminInput = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Invalid email settings',
      data: { issues: result.error.issues }
    })
  }
  return result.data
}

export const emailRenderInput = z.object({
  moduleId: z.string().min(1).max(100),
  definition: z.object({
    id: z.string().min(1).max(100),
    labelKey: z.string(),
    descriptionKey: z.string().optional(),
    defaults: z.object({ en: text, nl: text }),
    placeholders: z.array(
      z.object({ key: z.string(), labelKey: z.string(), descriptionKey: z.string().optional(), example: z.string() })
    )
  }),
  locale: z.enum(['en', 'nl']),
  text: text,
  htmlTemplate: z.string().max(100_000).optional(),
  to: z.string().email().optional()
})

export const emailSingleTextInput = z.object({
  definition: emailRenderInput.shape.definition,
  text
})
