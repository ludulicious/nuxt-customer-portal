import type { z } from 'zod'

export function useProductFormSchema<T extends z.ZodType>(
  schema: T,
  message?: (issue: z.ZodIssue) => string | undefined
) {
  const { t } = useI18n()
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'products',
      validate(value: unknown) {
        const parsed = schema.safeParse(value)
        return parsed.success
          ? { value: parsed.data }
          : {
              issues: parsed.error.issues.map((issue) => ({
                message: message?.(issue) || t('products.invalid'),
                path: issue.path.filter((p): p is string | number => typeof p !== 'symbol')
              }))
            }
      }
    }
  }
}
