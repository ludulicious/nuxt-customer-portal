import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { z } from 'zod'
import ts from 'typescript'
import { createClientSlug, isClientSlugConflict } from '../shared/client-slug'
import { clientUpdateSchema, genericClientCreateSchema } from '../server/utils/client-validation'
import { rethrowClientSlugConflict } from '../server/utils/client-slug-conflict'

test('client slug suggestions normalize names and stay within validated URL limits', () => {
  for (const [name, slug] of [
    ['  Café Déjà Vu B.V.  ', 'cafe-deja-vu-b-v'],
    ['ACME & Partners', 'acme-partners'],
    ['---', ''],
    ['a'.repeat(159) + ' BC', 'a'.repeat(159)],
    ['A'.repeat(200), 'a'.repeat(160)]
  ]) {
    assert.equal(createClientSlug(name!), slug)
  }
})

const formSource = readFileSync(new URL('../app/components/ClientsClientForm.vue', import.meta.url), 'utf8')
const script = formSource
  .split('<script setup lang="ts">')[1]!
  .split('</script>')[0]!
  .replace(/^import .*\n/gm, '')
const code = ts.transpileModule(
  `(async () => { ${script}; return { form, schema, submit, customizeSlug: () => slugCustomized.value = true } })()`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText

async function formHarness(client: Record<string, unknown> | null = null) {
  const props = reactive({ client, editing: Boolean(client) })
  const submissions: Record<string, unknown>[] = []
  const form = await runInNewContext(code, {
    z,
    computed,
    ref,
    reactive,
    watch,
    createClientSlug,
    defineProps: () => props,
    defineEmits: () => (_event: string, value: Record<string, unknown>) => submissions.push(value),
    defineExpose: () => {},
    useTemplateRef: () => ref(null),
    useI18n: () => ({ t: (key: string) => key }),
    useClientConfiguration: () => ref({ allowedTypes: ['organization', 'person'] }),
    useFetch: async () => ({ data: ref({ providerTimezone: 'Europe/Amsterdam' }) }),
    isValidTimezone: () => true
  })
  return { ...form, props, submissions }
}

test('new client slug follows display name until manually edited', async () => {
  const { form, customizeSlug } = await formHarness()
  form.name = 'Café Client'
  assert.equal(form.slug, 'cafe-client')
  form.name = 'Renamed Client'
  assert.equal(form.slug, 'renamed-client')
  customizeSlug()
  form.slug = 'my-custom-url'
  form.name = 'Another Display Name'
  assert.equal(form.slug, 'my-custom-url')
})

test('personal name suggestions generate editable slugs too', async () => {
  const { form, customizeSlug, submit, submissions } = await formHarness()
  form.clientType = 'person'
  form.firstName = 'Zoë'
  form.lastName = 'van Example'
  await nextTick()
  assert.equal(form.slug, 'zoe-van-example')
  customizeSlug()
  form.slug = 'private-client'
  form.firstName = 'Other'
  await nextTick()
  assert.equal(form.slug, 'private-client')
  submit()
  assert.equal(submissions[0]?.slug, 'private-client')
})

test('editing preserves saved slugs across name changes and submits deliberate edits', async () => {
  const { form, props, submit, submissions } = await formHarness({
    clientType: 'organization',
    name: 'Old Name',
    slug: 'saved-url',
    officialName: 'Old Name BV',
    timezone: null,
    address: '',
    preferredLocale: 'en'
  })
  form.name = 'New Name'
  assert.equal(form.slug, 'saved-url')
  form.slug = 'edited-url'
  submit()
  assert.equal(submissions[0]?.slug, 'edited-url')
  props.client = null
  await nextTick()
  form.name = 'Fresh Client'
  assert.equal(form.slug, 'fresh-client')
})

test('slug updates validate format and allow unchanged values', () => {
  assert.deepEqual(clientUpdateSchema.parse({ slug: 'valid-slug' }), { slug: 'valid-slug' })
  for (const slug of ['', 'Bad Slug', '-bad', 'bad--slug', 'x'.repeat(161), 'a/b', '../bad']) {
    assert.equal(clientUpdateSchema.safeParse({ slug }).success, false)
  }
  assert.equal(
    genericClientCreateSchema.safeParse({
      clientType: 'person',
      name: 'Private Client',
      firstName: 'Private',
      lastName: 'Client',
      slug: 'private-client'
    }).success,
    true
  )
})

test('slug races map only the matching unique constraint to a field conflict', () => {
  const globals = globalThis as typeof globalThis & { createError?: (input: object) => object }
  const previous = globals.createError
  globals.createError = (input) => input
  try {
    for (const error of [
      { code: '23505', constraint: 'organization_slug_unique' },
      { cause: { code: '23505', constraint: 'organization_slug_unique' } }
    ]) {
      assert.throws(() => rethrowClientSlugConflict(error), { statusCode: 409, data: { field: 'slug' } })
    }
    const other = { code: '23505', constraint: 'other_unique' }
    assert.throws(
      () => rethrowClientSlugConflict(other),
      (error) => error === other
    )
  } finally {
    globals.createError = previous
  }
  assert.equal(isClientSlugConflict({ status: 409, data: { data: { field: 'slug' } } }), true)
  assert.equal(isClientSlugConflict({ statusCode: 409, data: { data: { field: 'slug' } } }), true)
  assert.equal(isClientSlugConflict({ status: 500 }), false)
  assert.equal(isClientSlugConflict(null), false)
})
