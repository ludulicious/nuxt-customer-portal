import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, ref } from 'vue'
import ts from 'typescript'
import type { Slot } from '../shared/types'

const picker = readFileSync(new URL('../app/components/PlanningSlotPicker.vue', import.meta.url), 'utf8')
const script = picker.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
const parsed = ts.createSourceFile('picker.ts', script, ts.ScriptTarget.Latest, true)
const declarations = ['availableProviders', 'providerOptions', 'filtered']
const source = ts.transpileModule(
  parsed.statements
    .filter(
      (statement) =>
        (ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) => ts.isIdentifier(declaration.name) && declarations.includes(declaration.name.text)
          )) ||
        (ts.isFunctionDeclaration(statement) && statement.name?.text === 'load')
    )
    .map((statement) => statement.getText(parsed))
    .join('\n') + '\nexport { availableProviders, providerOptions, filtered, load }',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function harness() {
  const slots = ref<Slot[]>([])
  const provider = ref('any')
  let nextSlots: Slot[] = []
  const exports = {} as {
    availableProviders: { value: Array<{ value: string; label: string }> }
    providerOptions: { value: Array<{ value: string; label: string }> }
    filtered: { value: Slot[] }
    load(): Promise<void>
  }
  runInNewContext(source, {
    exports,
    computed,
    slots,
    provider,
    request: 0,
    loading: ref(false),
    error: ref(''),
    props: { productId: 'product' },
    month: ref(new Date('2026-11-01T00:00:00Z')),
    selectedDate: ref(''),
    availableDates: computed(() => new Set<string>()),
    t: (key: string) => key,
    loadMonth: async () => nextSlots
  })
  return {
    ...exports,
    provider,
    async loadProviders(...names: string[]) {
      nextSlots = names.map((name, index) => ({
        providerUserId: name,
        providerName: name,
        start: `2026-11-09T${String(9 + index).padStart(2, '0')}:00:00Z`,
        end: `2026-11-09T${String(9 + index).padStart(2, '0')}:30:00Z`
      }))
      await exports.load()
    }
  }
}

test('one available member is selected automatically without an any-member option or dropdown', async () => {
  const state = harness()
  await state.loadProviders('Marcel', 'Marcel')
  assert.equal(state.provider.value, 'Marcel')
  assert.equal(state.availableProviders.value.length, 1)
  assert.equal(state.providerOptions.value.length, 1)
  assert.equal(state.providerOptions.value[0]!.label, 'Marcel')
  assert.equal(state.filtered.value.length, 2)
  assert.match(picker, /<UFormField v-if="availableProviders.length > 1"/)
})

test('multiple members retain any-member selection and valid explicit selections', async () => {
  const state = harness()
  await state.loadProviders('Marcel', 'Boss')
  assert.equal(state.provider.value, 'any')
  assert.equal(state.providerOptions.value.length, 3)
  assert.equal(state.providerOptions.value[0]!.value, 'any')
  state.provider.value = 'Boss'
  await state.loadProviders('Marcel', 'Boss')
  assert.equal(state.provider.value, 'Boss')
  assert.equal(state.filtered.value.length, 1)
})

test('changing months replaces unavailable selections and handles empty availability', async () => {
  const state = harness()
  await state.loadProviders('Marcel')
  await state.loadProviders('Boss')
  assert.equal(state.provider.value, 'Boss')
  await state.loadProviders('Marcel', 'Other')
  assert.equal(state.provider.value, 'any')
  assert.equal(state.filtered.value.length, 2)
  await state.loadProviders()
  assert.equal(state.provider.value, 'any')
  assert.equal(state.providerOptions.value.length, 0)
  assert.equal(state.filtered.value.length, 0)
})
