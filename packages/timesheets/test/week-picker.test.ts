import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { parseDate } from '@internationalized/date'
import { addWeeks, format, parseISO } from 'date-fns'
import ts from 'typescript'
import { mondayFor } from '../shared/timesheet-dates'

const page = readFileSync(new URL('../app/pages/timesheets/index.vue', import.meta.url), 'utf8')
const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
const parsed = ts.createSourceFile('timesheets.ts', script, ts.ScriptTarget.Latest, true)
const handlers = ['selectWeek', 'changeWeek']
const source = ts.transpileModule(
  parsed.statements
    .filter(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) => ts.isIdentifier(declaration.name) && handlers.includes(declaration.name.text)
        )
    )
    .map((statement) => statement.getText(parsed))
    .join('\n') + '\nexport { selectWeek, changeWeek }',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function harness() {
  const state = {
    weekPickerOpen: { value: true },
    week: { value: { weekStartsOn: '2026-10-26' } as { weekStartsOn: string } | undefined },
    pending: { value: false },
    selectedWeek: { value: undefined as string | undefined }
  }
  const exports = {} as {
    selectWeek(value: unknown): void
    changeWeek(amount: number): void
  }
  runInNewContext(source, { exports, ...state, mondayFor, addWeeks, format, parseISO })
  return { ...exports, state }
}

test('selecting any date loads its Monday–Sunday timesheet week and closes the picker', () => {
  const fixture = harness()
  fixture.selectWeek(parseDate('2026-11-15'))
  assert.equal(fixture.state.selectedWeek.value, '2026-11-09')
  assert.equal(fixture.state.weekPickerOpen.value, false)
})

test('empty, range and multiple-date calendar values do not change the week', () => {
  const selected = parseDate('2026-11-15')
  for (const value of [null, undefined, [selected], { start: selected, end: selected }]) {
    const fixture = harness()
    fixture.selectWeek(value)
    assert.equal(fixture.state.selectedWeek.value, undefined)
    assert.equal(fixture.state.weekPickerOpen.value, false)
  }
})

test('selecting the displayed week or clearing its selection closes without reloading', () => {
  for (const selected of [parseDate('2026-10-26'), parseDate('2026-11-01'), undefined]) {
    const fixture = harness()
    fixture.selectWeek(selected)
    assert.equal(fixture.state.selectedWeek.value, undefined)
    assert.equal(fixture.state.weekPickerOpen.value, false)
  }
})

test('calendar selection respects loading and missing-week guards', () => {
  const loading = harness()
  loading.state.pending.value = true
  loading.selectWeek(parseDate('2026-12-01'))
  assert.equal(loading.state.selectedWeek.value, undefined)
  const missing = harness()
  missing.state.week.value = undefined
  missing.selectWeek(parseDate('2026-12-01'))
  assert.equal(missing.state.selectedWeek.value, undefined)
})

test('calendar selection handles year boundaries, leap days, and daylight-saving changes', () => {
  for (const [date, monday] of [
    ['2027-01-01', '2026-12-28'],
    ['2028-02-29', '2028-02-28'],
    ['2026-03-29', '2026-03-23'],
    ['2026-10-25', '2026-10-19']
  ]) {
    const fixture = harness()
    fixture.selectWeek(parseDate(date!))
    assert.equal(fixture.state.selectedWeek.value, monday)
  }
})

test('previous and next navigation still use the displayed week and ignore clicks while loading', () => {
  for (const [amount, expected] of [
    [-1, '2026-10-19'],
    [1, '2026-11-02']
  ] as const) {
    const fixture = harness()
    fixture.changeWeek(amount)
    assert.equal(fixture.state.selectedWeek.value, expected)
    fixture.state.pending.value = true
    fixture.changeWeek(-amount)
    assert.equal(fixture.state.selectedWeek.value, expected)
  }
})

test('the week label opens a localized calendar and selections use the existing bootstrap watcher', () => {
  assert.match(page, /<UPopover v-model:open="weekPickerOpen">/)
  assert.match(page, /:label="weekLabel"/)
  assert.match(page, /:disabled="pending \|\| !week"/)
  assert.match(page, /:week-starts-on="1"/)
  assert.match(page, /:model-value="calendarWeek"/)
  assert.match(page, /@update:model-value="selectWeek"/)
  assert.match(page, /timesheets.bootstrap\(selectedWeek.value\)/)
  assert.match(page, /watch: \[selectedWeek\]/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    assert.ok(messages.features.timesheets.pickWeek.includes('{week}'))
    assert.ok(messages.features.timesheets.selectWeek)
  }
})
