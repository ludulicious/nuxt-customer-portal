import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as z from 'zod'

const source = await readFile(new URL('../app/components/AuthenticationSignInForm.vue', import.meta.url), 'utf8')
const expression = source.match(/const schema = computed\(\(\) =>\n([\s\S]*?)\n\)\nconst forgotUrl/)?.[1]
assert.ok(expression)

for (const locale of ['en', 'nl']) {
  const messages = JSON.parse(await readFile(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
  const validation = messages.login.validation as Record<string, string>
  const schema = runInNewContext(`(${expression})`, {
    z,
    t: (key: string) => validation[key.replace('login.validation.', '')]
  }) as z.ZodObject<{ email: z.ZodString; password: z.ZodString }>

  test(`empty and missing sign-in fields show friendly ${locale} required messages`, () => {
    for (const value of [undefined, null, '']) {
      const result = schema.safeParse({ email: value, password: value })
      assert.equal(result.success, false)
      if (!result.success) {
        assert.deepEqual(
          result.error.issues.map((issue) => issue.message),
          [validation.emailRequired, validation.passwordRequired]
        )
      }
    }
  })

  test(`invalid sign-in values retain specific ${locale} validation messages`, () => {
    const result = schema.safeParse({ email: 'not-an-email', password: 'short' })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.deepEqual(
        result.error.issues.map((issue) => issue.message),
        [validation.invalidEmail, validation.passwordMinLength]
      )
    }
    assert.equal(schema.safeParse({ email: 'user@example.test', password: 'valid-password' }).success, true)
  })
}

test('sign-in uses Nuxt UI validation instead of native browser popups', () => {
  assert.match(source, /<UAuthForm\s+novalidate/)
})
