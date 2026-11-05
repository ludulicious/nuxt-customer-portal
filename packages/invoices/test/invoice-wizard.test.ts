import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import { computed, ref } from 'vue'
import ts from 'typescript'
import { loadAvailableInvoiceSources } from '../shared/invoice-sources'
import type { InvoiceSourceProvider } from '../shared/types/invoice'

const component = readFileSync(new URL('../app/components/InvoicesAdminInvoices.vue', import.meta.url), 'utf8')
const script = component.slice(component.indexOf('>') + 1, component.indexOf('</script>'))
const parsed = ts.createSourceFile('wizard.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const expressions = new Map<string, string>()
function collect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    expressions.set(node.name.getText(parsed), node.initializer.getText(parsed))
  }
  ts.forEachChild(node, collect)
}
collect(parsed)

const provider = (load: InvoiceSourceProvider['load']): InvoiceSourceProvider => ({
  id: 'timesheets',
  labelKey: 'approvedTime',
  descriptionKey: 'approvedTimeDescription',
  load,
  create: async () => ({ id: 'invoice' })
})
function harness(providers: InvoiceSourceProvider[] = []) {
  const step = ref(1)
  const source = ref<'FREE' | 'TIME' | ''>('')
  const availableProviders = ref<InvoiceSourceProvider[]>([])
  const sourcesUnavailable = ref(false)
  const context = createContext({
    computed,
    step,
    source,
    availableProviders,
    sourcesUnavailable,
    sourcesLoaded: ref(providers.length === 0),
    providers: ref(providers),
    loadAvailableInvoiceSources,
    periodFrom: ref('2026-10-01'),
    periodTo: ref('2026-10-31'),
    formOpen: ref(false),
    selectedProjectIds: ref([]),
    model: { clientOrganizationId: '', contactId: '', lines: [] },
    emptyLine: () => ({ description: '' })
  })
  for (const name of [
    'firstStep',
    'wizardSteps',
    'wizardPosition',
    'reset',
    'next',
    'back',
    'chooseFreeSource',
    'refreshAvailableProviders'
  ]) {
    const expression = expressions.get(name)
    assert.ok(expression, name)
    context[name] = runInContext(
      ts.transpileModule(`(${expression})`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 }
      }).outputText,
      context
    )
  }
  return {
    step,
    source,
    sourcesUnavailable,
    availableProviders,
    firstStep: context.firstStep as { value: number },
    wizardSteps: context.wizardSteps as { value: number[] },
    position: context.wizardPosition as { value: number },
    reset: context.reset as () => void,
    next: context.next as () => void,
    back: context.back as () => void,
    chooseFree: context.chooseFreeSource as () => void,
    refresh: context.refreshAvailableProviders as () => Promise<void>
  }
}

test('free-form-only creation starts at client selection and has two applicable steps', () => {
  const fixture = harness()
  fixture.reset()
  assert.equal(fixture.source.value, 'FREE')
  assert.equal(fixture.step.value, 2)
  assert.equal(fixture.position.value, 1)
  assert.deepEqual([...fixture.wizardSteps.value], [2, 5])
  fixture.next()
  assert.equal(fixture.step.value, 5)
  assert.equal(fixture.position.value, 2)
  fixture.back()
  assert.equal(fixture.step.value, 2)
  fixture.back()
  assert.equal(fixture.step.value, 2)
  assert.ok(component.includes("step === firstStep ? navigateTo('/admin/invoices') : back()"))
  assert.ok(component.includes("step === firstStep ? 'features.invoices.cancel'"))
})

test('disabled and failed optional sources skip selection without blocking free-form creation', async () => {
  for (const load of [
    async () => ({ enabled: false, entries: [] }),
    async () => {
      throw new Error('Source failed')
    }
  ]) {
    const fixture = harness([provider(load)])
    fixture.reset()
    assert.equal(fixture.step.value, 1)
    await fixture.refresh()
    assert.equal(fixture.step.value, 2)
    assert.equal(fixture.source.value, 'FREE')
    assert.equal(fixture.wizardSteps.value.length, 2)
    fixture.reset()
    assert.equal(fixture.step.value, 2)
  }
})

test('late source discovery and wizard initialization cannot restore the skipped step', async () => {
  let resolve: (result: { enabled: boolean; entries: [] }) => void = () => {}
  const pending = new Promise<{ enabled: boolean; entries: [] }>((done) => {
    resolve = done
  })
  const fixture = harness([provider(() => pending)])
  const loading = fixture.refresh()
  fixture.reset()
  assert.equal(fixture.step.value, 1)
  resolve({ enabled: false, entries: [] })
  await loading
  assert.equal(fixture.step.value, 2)
  fixture.reset()
  assert.equal(fixture.source.value, 'FREE')
  assert.equal(fixture.step.value, 2)
})

test('source selection remains available when approved-time invoicing is enabled', async () => {
  const fixture = harness([provider(async () => ({ enabled: true, entries: [] }))])
  fixture.reset()
  await fixture.refresh()
  assert.equal(fixture.step.value, 1)
  assert.equal(fixture.firstStep.value, 1)
  assert.deepEqual([...fixture.wizardSteps.value], [1, 2, 3, 4, 5])
  fixture.chooseFree()
  assert.equal(fixture.step.value, 2)
  assert.deepEqual([...fixture.wizardSteps.value], [1, 2, 5])
  fixture.back()
  assert.equal(fixture.step.value, 1)
  fixture.source.value = 'TIME'
  fixture.next()
  assert.equal(fixture.step.value, 2)
  assert.equal(fixture.wizardSteps.value.length, 5)
})
