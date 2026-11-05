import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { loadAvailableInvoiceSources } from '../../invoices/shared/invoice-sources'
import type { InvoiceSourceProvider } from '../../invoices/shared/types/invoice'

const source = ts.transpileModule(
  readFileSync(new URL('../app/plugins/invoice-timesheets-source.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText
const period = { from: '2026-10-01', to: '2026-10-31' }

function harness(enabledModules: string[] | null) {
  const settings = { value: enabledModules === null ? null : { enabledModules } }
  const calls: Array<{ endpoint: string; query: unknown }> = []
  const controls = { fail: false }
  let provider: InvoiceSourceProvider | undefined
  runInNewContext(source, {
    exports: {},
    defineNuxtPlugin: (setup: () => void) => setup(),
    useState: (key: string) => {
      assert.equal(key, 'portal-runtime-settings')
      return settings
    },
    useInvoiceSources: () => ({
      register: (value: InvoiceSourceProvider) => {
        provider = value
      }
    }),
    $fetch: async (endpoint: string, options: { query: unknown }) => {
      calls.push({ endpoint, query: options.query })
      if (controls.fail) {
        throw new Error('Source request failed')
      }
      return { enabled: true, entries: [] }
    }
  })
  assert.ok(provider)
  return { provider, calls, controls, settings }
}

test('disabled timesheet integration is unavailable without a request or load warning', async () => {
  for (const missing of ['invoices', 'timesheets', 'invoice-timesheets']) {
    const fixture = harness(['invoices', 'timesheets', 'invoice-timesheets'].filter((id) => id !== missing))
    const result = await loadAvailableInvoiceSources([fixture.provider], period)
    assert.equal(result.failed, false)
    assert.equal(result.available.length, 0)
    assert.equal(fixture.calls.length, 0)
  }
})

test('enabled integration loads approved-time sources and follows runtime module changes', async () => {
  const fixture = harness(['invoices', 'timesheets', 'invoice-timesheets'])
  const result = await loadAvailableInvoiceSources([fixture.provider], period)
  assert.equal(result.failed, false)
  assert.equal(result.available[0], fixture.provider)
  assert.equal(fixture.calls[0]?.endpoint, '/api/invoice-timesheets/sources')
  assert.deepEqual(fixture.calls[0]?.query, period)
  fixture.settings.value = { enabledModules: ['invoices', 'timesheets'] }
  const disabled = await loadAvailableInvoiceSources([fixture.provider], period)
  assert.equal(disabled.failed, false)
  assert.equal(disabled.available.length, 0)
  assert.equal(fixture.calls.length, 1)
})

test('standalone hosts without SaaS configuration can load the source', async () => {
  const fixture = harness(null)
  const result = await loadAvailableInvoiceSources([fixture.provider], period)
  assert.equal(result.failed, false)
  assert.equal(result.available[0], fixture.provider)
  assert.equal(fixture.calls.length, 1)
})

test('genuine source failures still show the load warning for enabled integrations', async () => {
  const fixture = harness(['invoices', 'timesheets', 'invoice-timesheets'])
  fixture.controls.fail = true
  const result = await loadAvailableInvoiceSources([fixture.provider], period)
  assert.equal(result.failed, true)
  assert.equal(result.available.length, 0)
})
