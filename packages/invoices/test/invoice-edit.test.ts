import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import ts from 'typescript'
import { invoiceUpdateSchema } from '../server/utils/invoice-validation'
import {
  editableInvoiceLines,
  hasSameInvoiceLineAmounts,
  invoiceLineErrorIndex,
  moveInvoiceLine,
  type InvoiceLineEdit
} from '../shared/invoice-line-edit'
import { loadAvailableInvoiceSources } from '../shared/invoice-sources'
import type { InvoiceSourceProvider } from '../shared/types/invoice'

const line = {
  id: 'line',
  description: 'Work',
  quantityMilli: 1000,
  unit: 'hour',
  unitPriceMinor: 5000,
  vatRateBasisPoints: 2100,
  amountMinor: 5000,
  exactTaxMinor: 1049
}
const input = { number: '2026.0011', issueDate: '2026-11-05', dueDate: '2026-12-05', lines: [line] }

const editorSource = readFileSync(new URL('../app/components/InvoicesInvoiceLinesEditor.vue', import.meta.url), 'utf8')
const editorHarness = (
  initialLines: InvoiceLineEdit[],
  nextTick: (callback?: () => void) => Promise<void> = async (callback) => {
    callback?.()
  },
  canRemove = (_line: InvoiceLineEdit) => true
) => {
  const lines = { value: initialLines }
  const activeLine = { value: null as InvoiceLineEdit | null }
  let finishedOrder: { id: string; ids: string[] } | undefined
  const started: string[] = []
  let focusedLine: InvoiceLineEdit | null = null
  const context = createContext({
    lines,
    activeLine,
    sortingDisabled: {
      get value() {
        return activeLine.value !== null || lines.value.length <= 1
      }
    },
    start: (_event: DragEvent, id: string) => started.push(id),
    finish: () => finishedOrder,
    nextTick,
    props: { canRemove },
    orderAnnouncement: { value: '' },
    lineKeys: new WeakMap(),
    nextLineKey: 0,
    moveInvoiceLine,
    invoiceLineErrorIndex,
    t: (key: string) => key,
    newLine: () => ({
      description: '',
      quantityMilli: 1000,
      unit: 'item',
      unitPriceMinor: 0,
      vatRateBasisPoints: 2100
    }),
    lineEditor: {
      value: {
        querySelector: (selector: string) => {
          assert.equal(selector, 'textarea')
          return {
            focus: () => {
              focusedLine = activeLine.value
            }
          }
        }
      }
    }
  })
  for (const name of [
    'lineKey',
    'editLine',
    'addLine',
    'moveLine',
    'removeLine',
    'startDrag',
    'dropLine',
    'focusError'
  ]) {
    const prefix = `const ${name} = `
    const start = editorSource.indexOf(prefix)
    assert.ok(start >= 0, name)
    const source = editorSource.slice(start + prefix.length, editorSource.indexOf('\n}', start) + 2)
    const code = ts.transpileModule('(' + source + ')', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 }
    }).outputText
    context[name] = runInContext(code, context)
  }
  return {
    lines,
    activeLine,
    started,
    finishedOrder: (value?: { id: string; ids: string[] }) => {
      finishedOrder = value
    },
    focusedLine: () => focusedLine,
    lineKey: context.lineKey as (line: InvoiceLineEdit) => number,
    addLine: context.addLine as () => Promise<void>,
    editLine: context.editLine as (line: InvoiceLineEdit) => Promise<void>,
    moveLine: context.moveLine as (
      line: InvoiceLineEdit,
      target: number,
      event?: { currentTarget: { focus: (options: { preventScroll: boolean }) => void } }
    ) => void,
    removeLine: context.removeLine as (line: InvoiceLineEdit) => void,
    startDrag: context.startDrag as (event: DragEvent, line: InvoiceLineEdit) => void,
    dropLine: context.dropLine as () => void,
    focusError: context.focusError as (errors: Array<{ name?: string }>) => Promise<void>
  }
}

test('adding a line opens only its editor and focuses its description after rendering', async () => {
  let render: () => void = () => {}
  const nextRender = new Promise<void>((resolve) => {
    render = resolve
  })
  const fixture = editorHarness([{ ...line }], () => nextRender)
  const adding = fixture.addLine()
  assert.equal(fixture.lines.value.length, 2)
  assert.equal(fixture.activeLine.value, fixture.lines.value[1])
  assert.equal(fixture.focusedLine(), null)
  render()
  await adding
  assert.equal(fixture.focusedLine(), fixture.lines.value[1])
  assert.match(editorSource, /v-if="isEditingLine\(line\)"/)
  assert.match(editorSource, /const isEditingLine = \(line: Line\): boolean => activeLine\.value === line/)
  assert.match(editorSource, /ref="lineEditor"/)
  assert.match(editorSource, /@click="addLine"/)
})

test('switching the edited line closes the previous fields and reordering preserves identity', async () => {
  const first = { ...line, timeEntryIds: ['entry'] }
  const second = { ...line, id: 'second', description: 'Second' }
  const fixture = editorHarness([first, second])
  await fixture.editLine(first)
  await fixture.editLine(second)
  assert.equal(fixture.activeLine.value, second)
  const key = fixture.lineKey(second)
  fixture.activeLine.value = null
  fixture.moveLine(second, 0)
  assert.equal(fixture.lines.value[0], second)
  assert.equal(fixture.activeLine.value, null)
  assert.equal(fixture.lineKey(second), key)
  assert.equal(fixture.lines.value[1], first)
  assert.deepEqual(first.timeEntryIds, ['entry'])
  assert.equal(first.exactTaxMinor, 1049)
})

test('media-style sorting commits the preview order while retaining line identities and amounts', () => {
  const first = { ...line, timeEntryIds: ['entry'] }
  const second = { ...line, id: 'second' }
  const fixture = editorHarness([first, second])
  const firstKey = String(fixture.lineKey(first))
  const secondKey = String(fixture.lineKey(second))
  fixture.startDrag({ target: { closest: () => ({}) } } as unknown as DragEvent, first)
  assert.deepEqual(fixture.started, [firstKey])
  fixture.finishedOrder({ id: firstKey, ids: [secondKey, firstKey] })
  fixture.dropLine()
  assert.equal(fixture.lines.value[0], second)
  assert.equal(fixture.lines.value[1], first)
  assert.equal(first.unitPriceMinor, 5000)
  assert.deepEqual(first.timeEntryIds, ['entry'])
  assert.match(editorSource, /useDragOrder/)
  assert.ok(editorSource.includes('v-for="(line, index) in orderedLines"'))
  assert.match(editorSource, /data-invoice-line-handle\s+:draggable="!sortingDisabled"/)
  assert.ok(editorSource.includes('@dragstart.stop="startDrag($event, line)"'))
  assert.match(editorSource, /@dragover="over"/)
  assert.match(editorSource, /@drop.prevent.stop="dropLine"/)
  assert.match(editorSource, /@keydown.up.prevent="moveLine/)
  assert.match(editorSource, /@keydown.down.prevent="moveLine/)
  assert.doesNotMatch(editorSource, /moveLineUp|moveLineDown|i-lucide-arrow-(up|down)/)
  const media = readFileSync(new URL('../../products/app/composables/useMediaDragOrder.ts', import.meta.url), 'utf8')
  assert.match(media, /useMediaDragOrder = useDragOrder/)
})

test('cancelled drags and dragging outside the handle leave the line order unchanged', () => {
  const first = { ...line }
  const fixture = editorHarness([first, { ...line, id: 'second' }])
  const original = fixture.lines.value
  fixture.dropLine()
  assert.equal(fixture.lines.value, original)
  let prevented = false
  fixture.startDrag(
    {
      target: { closest: () => null },
      preventDefault: () => {
        prevented = true
      }
    } as unknown as DragEvent,
    first
  )
  assert.equal(prevented, true)
  assert.deepEqual(fixture.started, [])
})

test('drag and keyboard sorting are disabled while any invoice line is being edited', () => {
  const first = { ...line }
  const second = { ...line, id: 'second' }
  const fixture = editorHarness([first, second])
  const original = fixture.lines.value
  fixture.activeLine.value = second
  let prevented = false
  fixture.startDrag(
    {
      target: { closest: () => ({}) },
      preventDefault: () => {
        prevented = true
      }
    } as unknown as DragEvent,
    first
  )
  fixture.moveLine(first, 1)
  assert.equal(prevented, true)
  assert.deepEqual(fixture.started, [])
  assert.equal(fixture.lines.value, original)
  fixture.activeLine.value = null
  fixture.moveLine(first, 1)
  assert.equal(fixture.lines.value[0], second)
})

test('invalid moves are ignored and valid moves preserve the original array and line objects', () => {
  const first = { ...line }
  const second = { ...line, id: 'second' }
  const original = [first, second]
  for (const [from, to] of [
    [-1, 0],
    [0, -1],
    [2, 0],
    [0, 2],
    [0.5, 1],
    [0, 0],
    [0, NaN]
  ]) {
    assert.equal(moveInvoiceLine(original, from!, to!), original)
  }
  const moved = moveInvoiceLine(original, 0, 1)
  assert.equal(moved[0], second)
  assert.equal(moved[1], first)
  assert.equal(original[0], first)
})

test('keyboard reordering keeps focus on the moved line handle', async () => {
  const first = { ...line }
  const second = { ...line, id: 'second' }
  const fixture = editorHarness([first, second])
  let focused = false
  fixture.moveLine(second, 0, {
    currentTarget: {
      focus: (options) => {
        assert.equal(options.preventScroll, true)
        focused = true
      }
    }
  })
  await Promise.resolve()
  assert.equal(fixture.lines.value[0], second)
  assert.equal(focused, true)
})

test('removing an active line closes it but retains the last line and protected time-source lines', async () => {
  const first = { ...line }
  const second = { ...line, id: 'second' }
  const fixture = editorHarness(
    [first, second],
    async () => {},
    (candidate) => candidate !== first
  )
  fixture.removeLine(first)
  assert.equal(fixture.lines.value.length, 2)
  await fixture.editLine(second)
  fixture.removeLine(second)
  assert.equal(fixture.activeLine.value, null)
  assert.equal(fixture.lines.value.length, 1)
  fixture.removeLine(first)
  assert.equal(fixture.lines.value.length, 1)
})

test('submission opens the first invalid collapsed line and ignores non-line errors', async () => {
  const first = { ...line }
  const second = { ...line, id: 'second' }
  const fixture = editorHarness([first, second])
  await fixture.editLine(first)
  await fixture.focusError([{ name: 'number' }, { name: 'lines.1.unitPriceMinor' }])
  assert.equal(fixture.activeLine.value, second)
  assert.equal(fixture.focusedLine(), second)
  await fixture.focusError([{ name: 'lines.10.description' }])
  assert.equal(fixture.activeLine.value, second)
  assert.equal(invoiceLineErrorIndex([{ name: 'notes' }]), undefined)
  assert.equal(invoiceLineErrorIndex([{ name: 'lines.0.description' }]), 0)
  for (const componentName of ['InvoicesInvoiceDetail', 'InvoicesAdminInvoices']) {
    const component = readFileSync(new URL('../app/components/' + componentName + '.vue', import.meta.url), 'utf8')
    assert.match(component, /<InvoicesInvoiceLinesEditor/)
    assert.match(component, /@error="lineEditor\?.focusError\(\$event.errors\)"/)
  }
})

test('VAT rate fields are labelled as percentages and display percent-formatted values', () => {
  assert.match(editorSource, /features\.invoices\.admin\.vatRate/)
  assert.match(editorSource, /style: 'percent'/)
  assert.match(editorSource, /:model-value="line\.vatRateBasisPoints \/ 10_000"/)
  assert.match(editorSource, /Math\.round\(Number\(.*\?\? 0\) \* 10_000\)/)
  for (const locale of ['en', 'nl']) {
    const translations = JSON.parse(
      readFileSync(new URL('../i18n/locales/' + locale + '.json', import.meta.url), 'utf8')
    )
    assert.match(translations.features.invoices.admin.vatRate, /%/)
    assert.match(
      new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2 }).format(2100 / 10_000),
      /21[.,]00\s?%/
    )
  }
})

test('draft updates validate lines and keep metadata-only requests compatible', () => {
  assert.equal(invoiceUpdateSchema.parse(input).lines![0]!.id, 'line')
  assert.equal(invoiceUpdateSchema.parse({ ...input, lines: undefined }).lines, undefined)
  for (const lines of [
    [],
    Array(501).fill(line),
    [{ ...line, description: '' }],
    [{ ...line, quantityMilli: 0 }],
    [{ ...line, quantityMilli: 1.5 }],
    [{ ...line, vatRateBasisPoints: 10001 }],
    [{ ...line, unitPriceMinor: 0.5 }],
    [{ ...line, unit: '' }]
  ]) {
    assert.equal(invoiceUpdateSchema.safeParse({ ...input, lines }).success, false)
  }
  assert.equal(invoiceUpdateSchema.safeParse({ ...input, dueDate: '2026-11-01' }).success, false)
  assert.equal(
    invoiceUpdateSchema.parse({ ...input, lines: [{ ...line, unitPriceMinor: -5000 }] }).lines![0]!.unitPriceMinor,
    -5000
  )
  assert.ok(!('exactTaxMinor' in invoiceUpdateSchema.parse(input).lines![0]!))
})

test('draft editing clones lines without exposing mutable invoice or tax metadata', () => {
  const edited = editableInvoiceLines([line])
  edited[0]!.description = 'Changed'
  assert.equal(line.description, 'Work')
  assert.ok(!('exactTaxMinor' in edited[0]!))
  assert.equal(hasSameInvoiceLineAmounts(edited[0]!, line), true)
  for (const field of ['quantityMilli', 'unitPriceMinor', 'vatRateBasisPoints'] as const) {
    assert.equal(hasSameInvoiceLineAmounts({ ...edited[0]!, [field]: 123 }, line), false)
  }
  assert.equal(hasSameInvoiceLineAmounts(edited[0]!), false)
})

test('failed optional invoice sources do not block manual creation or working sources', async () => {
  const source = (id: string, load: InvoiceSourceProvider['load']): InvoiceSourceProvider => ({
    id,
    labelKey: id,
    descriptionKey: id,
    load,
    create: async () => ({ id: 'draft' })
  })
  const query = { from: '2026-10-01', to: '2026-10-31' }
  const available = source('available', async (received) => {
    assert.deepEqual(received, query)
    return { enabled: true, entries: [] }
  })
  const disabled = source('disabled', async () => ({ enabled: false, entries: [] }))
  const failed = source('failed', async () => {
    throw new Error('Source unavailable')
  })
  assert.deepEqual(await loadAvailableInvoiceSources([failed, available, disabled], query), {
    available: [available],
    failed: true
  })
  assert.deepEqual(await loadAvailableInvoiceSources([], query), { available: [], failed: false })
})

test('new invoice navigation and initialization do not depend on optional source success', () => {
  const page = readFileSync(new URL('../app/pages/admin/invoices/index.vue', import.meta.url), 'utf8')
  const creation = readFileSync(new URL('../app/components/InvoicesAdminInvoices.vue', import.meta.url), 'utf8')
  const detail = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
  assert.equal((page.match(/to="\/admin\/invoices\/new"/g) ?? []).length, 2)
  assert.doesNotMatch(page, /@click="child.openCreate/)
  assert.match(creation, /onMounted\(\(\) => \{\s*void openWizard\(\)\s*void refreshAvailableProviders\(\)/)
  assert.match(creation, /initializationError.value = true/)
  assert.match(creation, /novalidate/)
  assert.match(detail, /v-model="edit.lines"/)
  assert.match(detail, /if \(saved\) \{\s*editOpen.value = false/)
})
