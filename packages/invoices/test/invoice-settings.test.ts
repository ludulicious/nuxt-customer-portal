import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'
import { z } from 'zod'
import ts from 'typescript'
import { invoiceSettingsSchema } from '../server/utils/invoice-validation'
import { editableInvoiceLines } from '../shared/invoice-line-edit'
import type { InvoiceSettingsDto } from '../shared/types/invoice'

const page = readFileSync(new URL('../app/pages/admin/invoices/settings.vue', import.meta.url), 'utf8')
const editor = readFileSync(new URL('../app/components/InvoicesInvoiceLinesEditor.vue', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
const transpile = (source: string) =>
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
const initializer = (source: string, name: string) => {
  const content = source.slice(source.indexOf('>') + 1, source.indexOf('</script>'))
  const parsed = ts.createSourceFile('component.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let expression = ''
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name) {
      expression = node.initializer!.getText(parsed)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  assert.ok(expression, name)
  return transpile(`(${expression})`)
}

async function settingsHarness(rate = 2100) {
  let stored: InvoiceSettingsDto = {
    organizationId: 'workspace',
    enabled: true,
    currency: 'EUR',
    defaultVatRateBasisPoints: rate,
    address: 'Sender address',
    country: 'NL',
    registrationNumber: 'registration',
    vatNumber: 'VAT',
    iban: 'IBAN',
    bic: 'BIC',
    invoiceEmail: 'billing@example.test',
    preferredLocale: 'en'
  }
  const notices: Array<{ title: string; color: string }> = []
  const writes: unknown[] = []
  const controls = { failSave: false }
  const api = {
    adminBootstrap: async () => ({ settings: { ...stored } }),
    updateSettings: async (input: unknown) => {
      if (controls.failSave) {
        throw new Error('Save failed')
      }
      const value = invoiceSettingsSchema.parse(input)
      writes.push(input)
      stored = { ...stored, ...value }
    }
  }
  const data = ref(await api.adminBootstrap())
  const scope = effectScope()
  const content = page.slice(page.indexOf('>') + 1, page.indexOf('</script>')).replaceAll('import.meta.client', 'false')
  const result = await scope.run(() =>
    runInNewContext(
      `(async () => {
    ${transpile(content)}
    return { general, generalSchema, saveGeneral, busy };
  })()`,
      {
        exports: {},
        require: (id: string) => {
          assert.equal(id, 'zod')
          return { z }
        },
        computed,
        reactive,
        ref,
        watch,
        useInvoices: () => api,
        useI18n: () => ({ t: (key: string) => key }),
        useToast: () => ({ add: (notice: (typeof notices)[number]) => notices.push(notice) }),
        useAsyncData: async () => ({
          data,
          refresh: async () => {
            data.value = await api.adminBootstrap()
            await nextTick()
          }
        })
      }
    )
  )
  return { ...result, notices, writes, controls, stored: () => stored, stop: () => scope.stop() }
}

test('workspace settings save percentage values as basis points and preserve other settings', async () => {
  const fixture = await settingsHarness(900)
  assert.equal(fixture.general.defaultVatRate, 0.09)
  for (const rate of [0, 750, 900, 2100, 10000]) {
    fixture.general.defaultVatRate = rate / 10000
    await fixture.saveGeneral()
    assert.equal(fixture.stored().defaultVatRateBasisPoints, rate)
    assert.equal(fixture.general.defaultVatRate, rate / 10000)
    assert.equal(fixture.stored().organizationId, 'workspace')
    assert.equal(fixture.stored().invoiceEmail, 'billing@example.test')
    assert.equal(fixture.stored().iban, 'IBAN')
    assert.equal(fixture.busy.value, false)
    assert.equal(fixture.notices.at(-1)?.color, 'success')
  }
  const reopened = await settingsHarness(fixture.stored().defaultVatRateBasisPoints)
  assert.equal(reopened.general.defaultVatRate, 1)
  reopened.stop()
  fixture.stop()
})

test('workspace VAT validation rejects missing and out-of-range values with field errors', async () => {
  const fixture = await settingsHarness()
  for (const value of [null, undefined, NaN, Infinity, -0.01, 1.0001, '21']) {
    const parsed = fixture.generalSchema.value.safeParse({ ...fixture.general, defaultVatRate: value })
    assert.equal(parsed.success, false)
    assert.equal(parsed.error!.issues[0]!.path[0], 'defaultVatRate')
    assert.equal(parsed.error!.issues[0]!.message, 'features.invoices.validation.vatPercentage')
  }
  assert.match(page, /<UForm[\s\S]*:schema="generalSchema"[\s\S]*novalidate/)
  assert.match(page, /name="defaultVatRate"/)
  assert.match(page, /style: 'percent'/)
  assert.doesNotMatch(page, /<form\b/)
  fixture.stop()
})

test('failed workspace settings saves preserve the entered percentage and show an error', async () => {
  const fixture = await settingsHarness()
  fixture.controls.failSave = true
  fixture.general.defaultVatRate = 0.09
  await fixture.saveGeneral()
  assert.equal(fixture.general.defaultVatRate, 0.09)
  assert.equal(fixture.stored().defaultVatRateBasisPoints, 2100)
  assert.equal(fixture.busy.value, false)
  assert.equal(fixture.notices.at(-1)?.color, 'error')
  fixture.stop()
})

test('new draft lines use the workspace default rather than copying the first line rate', () => {
  for (const rate of [0, 750, 900]) {
    const existing = { description: 'Existing', vatRateBasisPoints: 2100 }
    const create = runInNewContext(initializer(editor, 'newLine'), {
      props: { defaultVatRateBasisPoints: rate },
      lines: { value: [existing] }
    }) as () => { vatRateBasisPoints: number }
    assert.equal(create().vatRateBasisPoints, rate)
    assert.equal(existing.vatRateBasisPoints, 2100)
  }
})

test('opening draft editing retrieves current settings and keeps existing line VAT unchanged', async () => {
  for (const failure of [false, true]) {
    const edit = { lines: [] }
    const editOpen = { value: false }
    const busy = { value: false }
    const defaultRate = { value: 2100 }
    const open = runInNewContext(initializer(detail, 'openEdit'), {
      api: {
        getSettings: async () => {
          if (failure) {
            throw new Error('Unavailable')
          }
          return { defaultVatRateBasisPoints: 900 }
        }
      },
      props: {
        invoice: {
          number: '2026.001',
          issueDate: '2026-11-05',
          dueDate: '2026-12-05',
          lines: [{ description: 'Existing', vatRateBasisPoints: 2100 }]
        }
      },
      edit,
      editOpen,
      busy,
      defaultVatRateBasisPoints: defaultRate,
      editableInvoiceLines,
      toast: { add: () => {} },
      t: (key: string) => key
    }) as () => Promise<void>
    await open()
    assert.equal(editOpen.value, !failure)
    assert.equal(busy.value, false)
    if (!failure) {
      assert.equal(defaultRate.value, 900)
      assert.equal((edit.lines[0] as { vatRateBasisPoints: number }).vatRateBasisPoints, 2100)
    }
  }
  const endpoint = readFileSync(new URL('../server/api/invoices/admin/settings.get.ts', import.meta.url), 'utf8')
  assert.match(endpoint, /requireFeatureAccess\(event, invoicesFeature.policy, 'manage'\)/)
  assert.match(endpoint, /getInvoiceSettings\(organizationId\)/)
  assert.match(detail, /:default-vat-rate-basis-points="defaultVatRateBasisPoints"/)
})
