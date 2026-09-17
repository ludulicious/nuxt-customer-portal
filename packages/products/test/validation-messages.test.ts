import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { productValidationMessage } from '../shared/validation-messages'
import { productSchema, emptyProduct, categorySchema, billingSchema, settingsSchema } from '../shared/validation'

test('product errors explain required fields, slug format, text limits and prices', () => {
  const value = {
    ...emptyProduct(),
    slug: 'Bad slug',
    content: {
      en: { title: '', summary: 'x'.repeat(1001), description: '' },
      nl: { title: '', summary: '', description: '' }
    }
  }
  const issues = productSchema.safeParse(value).error!.issues
  assert.deepEqual(
    new Set(issues.map((issue) => productValidationMessage(issue, value).key)),
    new Set(['products.validation.slug', 'products.validation.maxLength', 'products.validation.required'])
  )
  const length = issues.find((issue) => issue.code === 'too_big')!
  assert.deepEqual(productValidationMessage(length, value).params, { max: 1000 })
  const paid = {
    ...value,
    slug: 'valid',
    status: 'published',
    prices: [{ currency: 'EUR', amount: 0, taxBehavior: 'inclusive' }]
  }
  assert.ok(
    productSchema
      .safeParse(paid)
      .error!.issues.some((issue) => productValidationMessage(issue, paid).key === 'products.validation.positivePrice')
  )
})

test('category, billing and store errors have actionable messages', () => {
  const examples = [
    [
      categorySchema,
      { code: 'bad code', content: { en: { name: 'Name', description: '' }, nl: { name: '', description: '' } } },
      'code'
    ],
    [
      billingSchema,
      {
        type: 'person',
        firstName: 'First',
        lastName: 'Last',
        name: 'Name',
        email: 'bad',
        company: '',
        address: 'Valid address',
        country: 'NL',
        registrationNumber: '',
        vatNumber: ''
      },
      'email'
    ],
    [settingsSchema, { enabled: false, defaultLocale: 'en', languages: [], currencies: ['EUR'] }, 'languages']
  ] as const
  for (const [schema, value, key] of examples) {
    assert.ok(
      schema
        .safeParse(value)
        .error!.issues.some((issue) => productValidationMessage(issue, value).key === `products.validation.${key}`)
    )
  }
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8')).products.validation
  const nl = JSON.parse(readFileSync(new URL('../i18n/locales/nl.json', import.meta.url), 'utf8')).products.validation
  assert.deepEqual(Object.keys(en).sort(), Object.keys(nl).sort())
})
