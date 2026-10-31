import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { parseDate } from '@internationalized/date'
import ts from 'typescript'

const page = readFileSync(new URL('../app/pages/availability.vue', import.meta.url), 'utf8')
const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
const parsed = ts.createSourceFile('availability.ts', script, ts.ScriptTarget.Latest, true)
const handlers = ['daysForWeek', 'selectWeek', 'moveWeek', 'navigateWeek']
const source = ts.transpileModule(
  parsed.statements
    .filter((statement) => ts.isFunctionDeclaration(statement) && handlers.includes(statement.name!.text))
    .map((statement) => 'export ' + statement.getText(parsed))
    .join('\n'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function harness(currentWeek = '2026-10-28') {
  const state = {
    week: { value: currentWeek },
    weekPickerOpen: { value: true },
    calendarNavigationDirection: { value: undefined as string | undefined },
    calendarTimezone: { value: 'America/New_York' },
    externalBusy: { value: [] as string[] },
    error: { value: '' },
    route: { query: { timezone: 'America/New_York', filter: 'retained', week: currentWeek } }
  }
  const requests: Array<{ days: string[]; timezone: string }> = []
  const navigations: Array<{ query: Record<string, string> }> = []
  const controls = { fail: false, wait: undefined as Promise<void> | undefined }
  const exports = {} as {
    daysForWeek(value: string): string[]
    selectWeek(value: unknown): Promise<void>
    moveWeek(delta: number): Promise<void>
  }
  const context = {
    exports,
    ...state,
    days: {
      get value() {
        return exports.daysForWeek(state.week.value)
      }
    },
    preloadedCalendarKey: '',
    fetchExternalBusy: async (days: string[], timezone: string) => {
      requests.push({ days: Array.from(days), timezone })
      await controls.wait
      if (controls.fail) {
        throw new Error('Failed to load')
      }
      return ['preloaded']
    },
    navigateTo: async (target: { query: Record<string, string> }) => {
      navigations.push(target)
    },
    t: (key: string) => key
  }
  runInNewContext(source, context)
  return { ...exports, state, requests, navigations, controls, context }
}

test('selecting a date jumps to its Monday, preserves URL filters, and preloads calendar events', async () => {
  const fixture = harness()
  await fixture.selectWeek(parseDate('2026-11-15'))
  assert.equal(fixture.state.weekPickerOpen.value, false)
  assert.equal(fixture.state.week.value, '2026-11-09')
  assert.deepEqual(fixture.requests, [
    {
      days: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'],
      timezone: 'America/New_York'
    }
  ])
  assert.deepEqual(
    { ...fixture.navigations[0]!.query },
    {
      timezone: 'America/New_York',
      filter: 'retained',
      week: '2026-11-09'
    }
  )
  assert.deepEqual(fixture.state.externalBusy.value, ['preloaded'])
  assert.equal(fixture.context.preloadedCalendarKey, '2026-11-09:America/New_York')
  assert.equal(fixture.state.calendarNavigationDirection.value, undefined)
})

test('empty, range and multiple-date calendar values do not navigate', async () => {
  const selected = parseDate('2026-11-15')
  for (const value of [null, undefined, [selected], { start: selected, end: selected }]) {
    const fixture = harness()
    await fixture.selectWeek(value)
    assert.equal(fixture.navigations.length, 0)
    assert.equal(fixture.requests.length, 0)
    assert.equal(fixture.state.weekPickerOpen.value, false)
  }
})

test('week selection handles month/year boundaries, leap days, and DST without date shifts', async () => {
  for (const [selected, monday] of [
    ['2027-01-01', '2026-12-28'],
    ['2028-02-29', '2028-02-28'],
    ['2026-03-29', '2026-03-23'],
    ['2026-10-25', '2026-10-19']
  ]) {
    const fixture = harness()
    await fixture.selectWeek(parseDate(selected!))
    assert.equal(fixture.state.week.value, monday)
    assert.equal(fixture.requests[0]!.days.length, 7)
  }
})

test('selecting the displayed week or deselecting its Monday simply closes the picker', async () => {
  for (const selected of [parseDate('2026-10-26'), parseDate('2026-11-01'), undefined]) {
    const fixture = harness()
    await fixture.selectWeek(selected)
    assert.equal(fixture.state.weekPickerOpen.value, false)
    assert.equal(fixture.state.week.value, '2026-10-28')
    assert.equal(fixture.requests.length, 0)
    assert.equal(fixture.navigations.length, 0)
  }
})

test('previous/next arrows continue to use the shared preloading navigation', async () => {
  const fixture = harness()
  await fixture.moveWeek(1)
  assert.equal(fixture.state.week.value, '2026-11-04')
  await fixture.moveWeek(-1)
  assert.equal(fixture.state.week.value, '2026-10-28')
  assert.equal(fixture.requests.length, 2)
})

test('navigation keeps the displayed week until events load and ignores concurrent navigation', async () => {
  const fixture = harness()
  let finish!: () => void
  fixture.controls.wait = new Promise<void>((resolve) => {
    finish = resolve
  })
  const pending = fixture.selectWeek(parseDate('2026-12-01'))
  assert.equal(fixture.state.calendarNavigationDirection.value, 'pick')
  assert.equal(fixture.state.week.value, '2026-10-28')
  await fixture.moveWeek(1)
  assert.equal(fixture.requests.length, 1)
  finish()
  await pending
  assert.equal(fixture.state.week.value, '2026-11-30')
  assert.equal(fixture.state.calendarNavigationDirection.value, undefined)
})

test('failed week navigation preserves the current week and clears the loading state', async () => {
  const fixture = harness()
  fixture.controls.fail = true
  await fixture.selectWeek(parseDate('2026-12-01'))
  assert.equal(fixture.state.week.value, '2026-10-28')
  assert.equal(fixture.state.error.value, 'planning.externalCalendarLoadError')
  assert.equal(fixture.state.calendarNavigationDirection.value, undefined)
  assert.equal(fixture.navigations.length, 0)
})
