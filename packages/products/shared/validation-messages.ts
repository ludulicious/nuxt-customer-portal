import type { z } from 'zod'

export function productValidationMessage(issue: z.ZodIssue, value: unknown) {
  const path = issue.path.flatMap((part) => String(part).split('.'))
  const field = path.at(-1) || ''
  let input: unknown = value
  for (const part of path) {
    input = input && typeof input === 'object' ? (input as Record<string, unknown>)[part] : undefined
  }
  const result = (key: string, params: Record<string, string | number> = {}) => ({
    key: `products.validation.${key}`,
    params
  })
  if (issue.code === 'too_big') {
    return result(issue.origin === 'array' ? 'maxItems' : issue.origin === 'number' ? 'maxNumber' : 'maxLength', {
      max: Number(issue.maximum)
    })
  }
  if (path[0] === 'markdownStyle' && field.endsWith('Color')) {
    return { key: 'products.markdown.invalidColor', params: {} }
  }
  if (path[0] === 'languages') {
    return result('languages')
  }
  if (path[0] === 'currencies') {
    return result('currencies')
  }
  if (field === 'defaultLocale' || field === 'locale') {
    return result('language')
  }
  if (field === 'priceId') {
    return result('priceSelection')
  }
  if (field === 'amount') {
    return result(issue.code === 'custom' ? 'positivePrice' : 'price')
  }
  if (field === 'prices') {
    return result(issue.message === 'Only one price per currency' ? 'duplicateCurrency' : 'prices')
  }
  if (field === 'fileIds' && issue.code === 'custom') {
    return result('file')
  }
  if (input === undefined || input === null || (typeof input === 'string' && !input.trim())) {
    return result('required')
  }
  const fields: Record<string, string> = {
    slug: 'slug',
    code: 'code',
    taxCode: 'taxCode',
    email: 'email',
    country: 'country',
    videoUrl: 'videoUrl',
    expiresAt: 'date'
  }
  if (fields[field]) {
    return result(fields[field])
  }
  if (issue.code === 'too_small') {
    return result(issue.origin === 'array' ? 'minItems' : issue.origin === 'number' ? 'minNumber' : 'minLength', {
      min: Number(issue.minimum)
    })
  }
  if (issue.code === 'invalid_value' || issue.code === 'invalid_key') {
    return result('selection')
  }
  if (issue.code === 'invalid_type') {
    return result(issue.expected === 'number' || issue.expected === 'int' ? 'number' : 'required')
  }
  return result('format')
}
