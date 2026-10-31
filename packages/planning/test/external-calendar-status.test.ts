import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { localParts, wallInstant } from '../shared/availability'
import type { CalendarBusyPeriod } from '../app/composables/usePlanning'

function compileFunctions(source: string, names: string[]) {
  const parsed = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true)
  return ts.transpileModule(
    parsed.statements
      .filter((statement) => ts.isFunctionDeclaration(statement) && names.includes(statement.name!.text))
      .map((statement) => statement.getText(parsed).replace(/^export /, ''))
      .join('\n') + `\nexports.handlers = { ${names.join(', ')} }`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText
}

const adapters = compileFunctions(readFileSync(new URL('../server/utils/adapters.ts', import.meta.url), 'utf8'), [
  'externalBusyDetails',
  'externalBusy'
])
const timedEvent = {
  start: { dateTime: '2026-12-07T09:00:00Z' },
  end: { dateTime: '2026-12-07T10:00:00Z' }
}
const from = new Date('2026-12-07T00:00:00Z')
const to = new Date('2026-12-14T00:00:00Z')

function adapterHarness(pages: unknown[], fail = false) {
  const paths: string[] = []
  const exports = {} as {
    handlers: Pick<typeof import('../server/utils/adapters'), 'externalBusyDetails' | 'externalBusy'>
  }
  runInNewContext(adapters, {
    exports,
    URLSearchParams,
    wallInstant,
    calendarPath: () => '/calendars/calendar/events',
    api: async (_provider: string, _store: string, _user: string, path: string) => {
      paths.push(path)
      if (fail) {
        throw new Error('Event details unavailable')
      }
      return pages[paths.length - 1]
    },
    googleCalendar: { busy: async () => [{ start: timedEvent.start.dateTime, end: timedEvent.end.dateTime }] }
  })
  return { ...exports.handlers, paths }
}

test('external details retain Busy and Free events, including all-day events and pagination', async () => {
  const fixture = adapterHarness([
    {
      timeZone: 'Europe/Amsterdam',
      nextPageToken: 'next-page',
      items: [
        { ...timedEvent, summary: ' Busy ', transparency: 'opaque' },
        { ...timedEvent, summary: 'Default' },
        { ...timedEvent, summary: 'Free', transparency: 'transparent' },
        { ...timedEvent, status: 'cancelled' },
        { ...timedEvent, extendedProperties: { private: { portalPlanning: 'availability' } } }
      ]
    },
    {
      timeZone: 'Europe/Amsterdam',
      items: [true, false].map((busy) => ({
        summary: busy ? 'All-day busy' : 'All-day free',
        transparency: busy ? 'opaque' : 'transparent',
        start: { date: '2026-12-07' },
        end: { date: '2026-12-09' }
      }))
    }
  ])
  const events = await fixture.externalBusyDetails('store', 'user', ['calendar'], from, to)
  assert.deepEqual(
    Array.from(events, (event) => [event.title, event.busy]),
    [
      ['Busy', true],
      ['Default', true],
      ['Free', false],
      ['All-day busy', true],
      ['All-day free', false]
    ]
  )
  assert.equal(events[3]!.allDay, true)
  assert.equal(events[3]!.start, '2026-12-06T23:00:00.000Z')
  assert.equal(events[4]!.endDate, '2026-12-09')
  assert.match(fixture.paths[1]!, /pageToken=next-page/)
})

test('booking conflicts continue to exclude Free, cancelled and portal-managed events', async () => {
  const fixture = adapterHarness([
    {
      items: [
        { ...timedEvent, transparency: 'opaque' },
        { ...timedEvent },
        { ...timedEvent, transparency: 'transparent' },
        { ...timedEvent, status: 'cancelled' },
        { ...timedEvent, extendedProperties: { private: { portalPlanning: 'appointment' } } }
      ]
    }
  ])
  const busy = await fixture.externalBusy('store', 'user', ['calendar'], from, to)
  assert.equal(busy.length, 2)
})

test('free/busy-only calendar fallback explicitly marks returned intervals Busy', async () => {
  const fixture = adapterHarness([], true)
  const events = await fixture.externalBusyDetails('store', 'user', ['calendar'], from, to)
  assert.equal(events.length, 1)
  assert.equal(events[0]!.busy, true)
  assert.equal(events[0]!.start, timedEvent.start.dateTime)
})

const calendar = readFileSync(new URL('../app/components/PlanningAvailabilityCalendar.vue', import.meta.url), 'utf8')
const calendarHandlers = compileFunctions(calendar.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!, [
  'externalEventTitle',
  'externalBusyFor',
  'allDayBusyFor',
  'isDayBlocked',
  'windowHasBusyOverlap'
])

function calendarHarness(periods: CalendarBusyPeriod[]) {
  const exports = {} as {
    handlers: {
      externalEventTitle(period: CalendarBusyPeriod): string
      externalBusyFor(date: string): CalendarBusyPeriod[]
      allDayBusyFor(date: string): CalendarBusyPeriod[]
      isDayBlocked(date: string): boolean
      windowHasBusyOverlap(date: string, window: { startTime: string; endTime: string }): boolean
    }
  }
  runInNewContext(calendarHandlers, {
    exports,
    props: { externalBusy: periods, timezone: 'UTC' },
    localParts,
    minutes: (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)),
    appointmentsFor: () => [],
    t: (key: string) => key
  })
  return exports.handlers
}

test('Free events stay visible without obscuring availability details as busy overlaps', () => {
  for (const busy of [false, true, undefined]) {
    const fixture = calendarHarness([{ start: timedEvent.start.dateTime, end: timedEvent.end.dateTime, busy }])
    assert.equal(fixture.externalBusyFor('2026-12-07').length, 1)
    assert.equal(fixture.windowHasBusyOverlap('2026-12-07', { startTime: '08:00', endTime: '12:00' }), busy !== false)
  }
})

test('all-day Free events remain visible on each included day with exclusive end boundaries', () => {
  const fixture = calendarHarness([
    {
      start: '2026-12-07T00:00:00Z',
      end: '2026-12-09T00:00:00Z',
      busy: false,
      allDay: true,
      startDate: '2026-12-07',
      endDate: '2026-12-09'
    }
  ])
  assert.equal(fixture.allDayBusyFor('2026-12-07')[0]!.busy, false)
  assert.equal(fixture.allDayBusyFor('2026-12-08').length, 1)
  assert.equal(fixture.allDayBusyFor('2026-12-09').length, 0)
  assert.equal(fixture.externalBusyFor('2026-12-07').length, 0)
})

test('Busy all-day events block every included day across year boundaries, excluding the end date', () => {
  for (const busy of [true, undefined]) {
    const fixture = calendarHarness([
      {
        start: '2026-12-31T00:00:00Z',
        end: '2027-01-03T00:00:00Z',
        allDay: true,
        busy,
        startDate: '2026-12-31',
        endDate: '2027-01-03'
      }
    ])
    assert.equal(fixture.isDayBlocked('2026-12-30'), false)
    assert.equal(fixture.isDayBlocked('2026-12-31'), true)
    assert.equal(fixture.isDayBlocked('2027-01-01'), true)
    assert.equal(fixture.isDayBlocked('2027-01-02'), true)
    assert.equal(fixture.isDayBlocked('2027-01-03'), false)
  }
})

test('Free all-day events, timed Busy events, and empty days do not block entire day columns', () => {
  for (const periods of [
    [],
    [{ start: timedEvent.start.dateTime, end: timedEvent.end.dateTime, busy: true }],
    [
      {
        start: '2026-12-07T00:00:00Z',
        end: '2026-12-08T00:00:00Z',
        allDay: true,
        busy: false,
        startDate: '2026-12-07',
        endDate: '2026-12-08'
      }
    ]
  ]) {
    assert.equal(calendarHarness(periods).isDayBlocked('2026-12-07'), false)
  }
})

test('a Busy all-day event blocks the column even when a Free all-day event is also present', () => {
  const periods = [false, true].map((busy) => ({
    start: '2026-12-07T00:00:00Z',
    end: '2026-12-08T00:00:00Z',
    allDay: true,
    busy,
    startDate: '2026-12-07',
    endDate: '2026-12-08'
  }))
  assert.equal(calendarHarness(periods).isDayBlocked('2026-12-07'), true)
})

test('blocked days tint each column section and use a subtle inline tooltip instead of a blocked badge', () => {
  assert.equal(calendar.match(/:class="\{ 'bg-warning\/10': isDayBlocked\(date\) \}"/g)?.length, 3)
  assert.match(calendar, /v-if="isDayBlocked\(date\)"/)
  assert.match(calendar, /<UTooltip v-if="isDayBlocked\(date\)" :text="t\('planning.dayBlockedForAppointments'\)">/)
  assert.match(calendar, /i-lucide-info/)
  assert.doesNotMatch(calendar, /i-lucide-circle-minus|t\('planning.dayBlocked'\)/)
  assert.match(calendar, /:aria-label="[\s\S]*?t\('planning.dayBlockedForAppointments'\)/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    assert.ok(messages.planning.dayBlockedForAppointments)
  }
})

test('untitled external events use a fallback matching their Busy/Free status', () => {
  const fixture = calendarHarness([])
  const period = { start: '', end: '' }
  assert.equal(fixture.externalEventTitle({ ...period, busy: false }), 'planning.externalCalendarFree')
  assert.equal(fixture.externalEventTitle(period), 'planning.externalCalendarBusy')
  assert.equal(fixture.externalEventTitle({ ...period, title: 'Own title', busy: false }), 'Own title')
})

test('timed and all-day external event popovers receive the status and both locales provide labels', () => {
  assert.equal(calendar.match(/:availability-status="period.busy === false \? 'free' : 'busy'"/g)?.length, 2)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    assert.equal(messages.planning.externalEventBusy, locale === 'en' ? 'Busy' : 'Bezet')
    assert.equal(messages.planning.externalEventFree, locale === 'en' ? 'Free' : 'Vrij')
  }
})
