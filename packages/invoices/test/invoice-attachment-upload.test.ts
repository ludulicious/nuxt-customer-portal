import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
const script = source.split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const parsed = ts.createSourceFile('invoice.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const declarations = parsed.statements.filter(
  (statement) =>
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some((declaration) =>
      ['uploadAttachment', 'run'].includes(declaration.name.getText(parsed))
    )
)
assert.equal(declarations.length, 2)
const compiled = ts.transpileModule(
  declarations.map((statement) => statement.getText(parsed)).join('\n') + '\nexports.upload = uploadAttachment',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function harness(options: { fail?: boolean; busy?: boolean; client?: boolean; pending?: Promise<void> } = {}) {
  const busy = { value: options.busy ?? false }
  const attachment = { value: null as File | null }
  const requests: Array<{ id: string; file: File }> = []
  const notifications: Array<{ title: string; color: string }> = []
  let refreshes = 0
  const exports = {} as { upload: (file: File | null | undefined) => Promise<void> }
  runInNewContext(compiled, {
    exports,
    busy,
    attachment,
    isClient: { value: options.client ?? false },
    props: { invoice: { id: 'invoice-id' }, refresh: async () => refreshes++ },
    api: {
      addInvoiceAttachment: async (id: string, file: File) => {
        requests.push({ id, file })
        await options.pending
        if (options.fail) {
          throw new Error('Upload failed')
        }
      }
    },
    toast: { add: (notification: (typeof notifications)[number]) => notifications.push(notification) },
    t: (key: string) => key
  })
  return { ...exports, busy, attachment, requests, notifications, refreshes: () => refreshes }
}

test('Attach file opens the Nuxt UI chooser instead of requiring a prior selection', () => {
  const section = source.split('<section class="invoice-attachments print:hidden">')[1]!.split('</section>')[0]!
  assert.match(section, /<UFileUpload[\s\S]*v-if="!isClient"[\s\S]*v-model="attachment"/)
  assert.match(section, /v-slot="\{ open \}"/)
  assert.match(section, /\sreset\s/)
  assert.match(section, /@update:model-value="uploadAttachment"/)
  assert.match(section, /:disabled="busy"[\s\S]*@click="open\(\)"/)
  assert.doesNotMatch(section, /:disabled="!attachment"|<input/)
})

test('selection uploads the actual file and refreshes the invoice with success feedback', async () => {
  const state = harness()
  const file = new File(['invoice notes'], 'notes.txt', { type: 'text/plain' })
  state.attachment.value = file
  await state.upload(file)
  assert.deepEqual(state.requests, [{ id: 'invoice-id', file }])
  assert.equal(state.refreshes(), 1)
  assert.equal(state.notifications[0]?.color, 'success')
  assert.equal(state.attachment.value, null)
  assert.equal(state.busy.value, false)
})

test('cancelled selection, client mode, and busy actions never upload', async () => {
  const file = new File(['notes'], 'notes.txt')
  const cancelled = harness()
  await cancelled.upload(null)
  await cancelled.upload(undefined)
  assert.equal(cancelled.requests.length, 0)
  assert.equal(cancelled.refreshes(), 0)
  for (const state of [harness({ client: true }), harness({ busy: true })]) {
    await state.upload(file)
    assert.equal(state.requests.length, 0)
    assert.equal(state.refreshes(), 0)
  }
})

test('pending upload rejects duplicate selections until it finishes', async () => {
  let complete!: () => void
  const pending = new Promise<void>((resolve) => {
    complete = resolve
  })
  const state = harness({ pending })
  const file = new File(['notes'], 'notes.txt')
  const upload = state.upload(file)
  assert.equal(state.busy.value, true)
  await state.upload(file)
  assert.equal(state.requests.length, 1)
  complete()
  await upload
  assert.equal(state.busy.value, false)
})

test('failed upload shows an error and clears selection so the same file can be retried', async () => {
  const state = harness({ fail: true })
  const file = new File(['notes'], 'notes.txt')
  for (let attempt = 0; attempt < 2; attempt++) {
    state.attachment.value = file
    await state.upload(file)
    assert.equal(state.attachment.value, null)
    assert.equal(state.busy.value, false)
    assert.equal(state.notifications[attempt]?.color, 'error')
  }
  assert.equal(state.refreshes(), 0)
  assert.equal(state.requests.length, 2)
})
