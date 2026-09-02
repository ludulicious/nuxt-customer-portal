import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isTimesheetDateLocked } from '../shared/period-lock'

test('submitted and approved periods lock every date, including both boundaries', () => {
  for (const status of ['SUBMITTED', 'APPROVED']) {
    const periods = [{ status, periodStartsOn: '2026-08-31', periodEndsOn: '2026-09-02' }]
    for (const date of ['2026-08-31', '2026-09-01', '2026-09-02']) {
      assert.equal(isTimesheetDateLocked(date, periods), true)
    }
    assert.equal(isTimesheetDateLocked('2026-08-30', periods), false)
    assert.equal(isTimesheetDateLocked('2026-09-03', periods), false)
  }
})

test('a partial submission leaves the rest of the week open', () => {
  const periods = [{ status: 'APPROVED', periodStartsOn: '2026-08-31', periodEndsOn: '2026-08-31' }]
  assert.equal(isTimesheetDateLocked('2026-08-31', periods), true)
  assert.equal(isTimesheetDateLocked('2026-09-01', periods), false)
})

test('rejected, reopened and unsubmitted periods remain editable', () => {
  for (const status of ['DRAFT', 'REJECTED']) {
    assert.equal(
      isTimesheetDateLocked('2026-08-31', [{ status, periodStartsOn: '2026-08-31', periodEndsOn: '2026-09-06' }]),
      false
    )
  }
  assert.equal(isTimesheetDateLocked('2026-08-31', []), false)
})

test('entry and timer mutations use the same transaction guard as week submission', () => {
  const source = readFileSync(new URL('../server/utils/timesheet-repository.ts', import.meta.url), 'utf8')
  for (const name of ['createEntry', 'updateEntry', 'deleteEntry', 'startTimer', 'stopTimer']) {
    const body = source.split(`export const ${name} =`)[1]!.split('export const ')[0]!
    assert.match(body, /withEditableDates\(/)
  }
  const guard = source.split('const withEditableDates =')[1]!.split('const requireEditableEntry')[0]!
  assert.match(guard, /db.transaction/)
  assert.match(guard, /pg_advisory_xact_lock/)
  assert.match(guard, /isTimesheetDateLocked/)
  assert.match(guard, /statusCode: 409/)
})
