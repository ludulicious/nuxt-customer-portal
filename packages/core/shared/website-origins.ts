import { z } from 'zod'

// Exact origins only: no wildcard, credentials, path, query, or fragment.
export const websiteOriginSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value)
      return (
        !value.includes('*') &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost'))
      )
    } catch {
      return false
    }
  }, 'Use an HTTPS website origin without a path, such as https://www.example.com')
  .transform((value) => new URL(value).origin)

export const websiteOriginsSchema = z
  .array(websiteOriginSchema)
  .max(20)
  .transform((values) => [...new Set(values)])
