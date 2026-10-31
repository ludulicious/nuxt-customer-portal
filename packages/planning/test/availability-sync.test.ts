import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as availability from '../shared/availability'
import * as availabilityCalendar from '../shared/availability-calendar'
import type { CalendarEvent } from '../server/utils/adapters'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(
  readFileSync(new URL('../server/utils/jobs.ts', import.meta.url), 'utf8') +
    '\nexport { availabilityEffects as synchronizeAvailability }',
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }
).outputText

function harness(recurring = false) {
  const window = {
    id: 'window',
    store_id: 'store',
    user_id: 'provider',
    revision: 1,
    deleted: false,
    calendar_id: 'calendar' as string | null,
    calendar_event_id: 'original' as string | null,
    calendar_segments: [] as Array<{ id: string; calendarId: string }>,
    data: {
      id: 'window',
      userId: 'provider',
      date: '2026-10-26',
      endDate: null,
      timezone: 'UTC',
      startTime: '09:00',
      endTime: '17:00',
      recurring,
      productIds: null,
      exceptions: []
    }
  }
  const provider = {
    write_calendar_id: 'calendar',
    availability_sync_enabled: true,
    availability_calendar_title: 'Availability'
  }
  const state = {
    appointments: [
      {
        start_at: new Date('2026-10-26T10:00:00Z'),
        end_at: new Date('2026-10-26T11:00:00Z'),
        snapshot: { graceMinutes: 15 }
      }
    ],
    failAfter: Infinity,
    writes: 0,
    replacementIds: false,
    changeDuringSync: false,
    completed: false
  }
  const queued: string[] = []
  const client = {
    query: async (sql: string) => {
      if (sql.startsWith('UPDATE planning.job SET completed_at')) {
        state.completed = true
      }
      return { rows: [{ locked: true }] }
    },
    release: () => {}
  }
  const events = new Map<string, CalendarEvent>()
  const adapter = {
    put: async (_store: string, _user: string, calendar: string, event: CalendarEvent) => {
      if (state.changeDuringSync) {
        window.revision++
        state.changeDuringSync = false
      }
      if (state.writes++ >= state.failAfter) {
        throw new Error('Calendar unavailable')
      }
      const id = state.replacementIds ? event.id + 'replacement' : event.id
      events.set(calendar + '/' + id, { ...event, id })
      return { id, wasMissing: false }
    },
    remove: async (_store: string, _user: string, calendar: string, id: string) => {
      events.delete(calendar + '/' + id)
    }
  }
  const exports = {} as {
    synchronizeAvailability(id: string): Promise<number>
    runJobs(): Promise<{ completed: number; failed: number }>
  }
  runInNewContext(source, {
    exports,
    console,
    require: (id: string) => {
      if (id.endsWith('/utils/database')) {
        return {
          transaction: async (callback: (tx: typeof client) => Promise<void>) => callback(client),
          rows: async (sql: string, values: unknown[]) => {
            if (sql.startsWith('WITH scoped')) {
              return [{ id: 'availability-job', kind: 'availability', payload: { id: window.id }, attempts: 0 }]
            }
            if (sql.startsWith('SELECT completed_at')) {
              return [{ completed_at: state.completed ? new Date() : null }]
            }
            if (sql.startsWith('SELECT revision FROM planning.availability')) {
              return [{ revision: window.revision }]
            }
            if (sql.startsWith('SELECT * FROM planning.availability')) {
              return [structuredClone(window)]
            }
            if (sql.startsWith('SELECT write_calendar_id')) {
              return [provider]
            }
            if (sql.startsWith('SELECT start_at,end_at,snapshot')) {
              return state.appointments
            }
            if (sql.startsWith('UPDATE planning.availability SET calendar_segments=$2')) {
              window.calendar_segments = JSON.parse(values[1] as string)
            } else if (sql.startsWith("UPDATE planning.availability SET calendar_segments='[]'")) {
              window.calendar_segments = []
            } else if (sql.startsWith('UPDATE planning.availability SET calendar_event_id=$2')) {
              window.calendar_event_id = values[1] as string
              window.calendar_id = values[2] as string
            } else if (sql.startsWith('UPDATE planning.availability SET calendar_event_id=NULL')) {
              window.calendar_event_id = null
              window.calendar_id = null
            }
            return []
          }
        }
      }
      if (id === './adapters') {
        return { calendarAdapter: () => adapter }
      }
      if (id.endsWith('/utils/db')) {
        return { pool: { connect: async () => client } }
      }
      if (id === './booking') {
        return {
          enqueue: async (_tx: unknown, id: string) => {
            queued.push(id)
          }
        }
      }
      if (id === './crypto') {
        return { digest: (value: string) => createHash('sha256').update(value).digest('hex') }
      }
      if (id === '../../shared/availability') {
        return availability
      }
      if (id === '../../shared/availability-calendar') {
        return availabilityCalendar
      }
      if (id.startsWith('.') || id.startsWith('@nuxt-customer-portal/')) {
        return {}
      }
      return require(id)
    }
  })
  return {
    window,
    provider,
    state,
    events,
    queued,
    runJobs: () => exports.runJobs(),
    sync: () => exports.synchronizeAvailability('window')
  }
}

test('a booking change during synchronization queues a fresh revision after completing the old job', async () => {
  const fixture = harness()
  fixture.state.changeDuringSync = true
  const result = await fixture.runJobs()
  assert.equal(result.completed, 1)
  assert.equal(result.failed, 0)
  assert.equal(fixture.state.completed, true)
  assert.deepEqual(fixture.queued, ['availability:window:2'])
})

test('single-window mirrors split, move, restore and retain free status', async () => {
  const fixture = harness()
  await fixture.sync()
  assert.equal(fixture.events.size, 2)
  assert.deepEqual(
    [...fixture.events.values()].map((event) => [event.start.dateTime, event.end.dateTime]),
    [
      ['2026-10-26T09:00:00.000Z', '2026-10-26T10:00:00.000Z'],
      ['2026-10-26T11:15:00.000Z', '2026-10-26T17:00:00.000Z']
    ]
  )
  assert.ok([...fixture.events.values()].every((event) => event.transparency === 'transparent'))
  fixture.state.appointments[0]!.start_at = new Date('2026-10-26T12:00:00Z')
  fixture.state.appointments[0]!.end_at = new Date('2026-10-26T13:00:00Z')
  fixture.window.revision++
  await fixture.sync()
  assert.equal(fixture.events.size, 2)
  assert.ok([...fixture.events.values()].some((event) => event.end.dateTime === '2026-10-26T12:00:00.000Z'))
  fixture.state.appointments = []
  fixture.window.revision++
  await fixture.sync()
  assert.equal(fixture.events.size, 1)
  assert.equal(fixture.window.calendar_segments.length, 0)
})

test('weekly mirrors exclude only booked occurrences and restore on cancellation', async () => {
  const fixture = harness(true)
  await fixture.sync()
  assert.equal(fixture.events.size, 3)
  assert.deepEqual(Array.from(fixture.events.get('calendar/original')!.recurrence!), [
    'RRULE:FREQ=WEEKLY',
    'EXDATE;TZID=UTC:20261026T090000'
  ])
  fixture.state.appointments = []
  fixture.window.revision++
  await fixture.sync()
  assert.equal(fixture.events.size, 1)
  assert.deepEqual(Array.from(fixture.events.get('calendar/original')!.recurrence!), ['RRULE:FREQ=WEEKLY'])
})

test('partial failures retry without orphaned fragments and deletion removes all mirrors', async () => {
  const fixture = harness()
  fixture.state.failAfter = 1
  await assert.rejects(fixture.sync(), /Calendar unavailable/)
  assert.equal(fixture.window.calendar_segments.length, 2)
  fixture.state.failAfter = Infinity
  await fixture.sync()
  await fixture.sync()
  assert.equal(fixture.events.size, 2)
  fixture.window.deleted = true
  await fixture.sync()
  assert.equal(fixture.events.size, 0)
  assert.equal(fixture.window.calendar_segments.length, 0)
})

test('calendar changes and disabling sync clean up returned replacement IDs', async () => {
  const fixture = harness()
  fixture.state.replacementIds = true
  await fixture.sync()
  assert.ok(fixture.window.calendar_segments.every((segment) => segment.id.endsWith('replacement')))
  fixture.provider.write_calendar_id = 'other'
  await fixture.sync()
  assert.equal(fixture.events.size, 2)
  assert.ok([...fixture.events.keys()].every((key) => key.startsWith('other/')))
  fixture.provider.availability_sync_enabled = false
  await fixture.sync()
  assert.equal(fixture.events.size, 0)
})
