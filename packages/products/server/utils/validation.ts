import type { z } from 'zod'
import { createError } from 'h3'

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request',
      data: { errors: result.error.issues.map((issue) => ({ name: issue.path.join('.'), message: issue.message })) }
    })
  }
  return result.data
}
