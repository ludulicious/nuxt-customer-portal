import assert from 'node:assert/strict'
import test from 'node:test'
import { createHoursIntroduction } from '../shared/invoice-introduction'

test('hours introduction uses unique people and actual entry dates', () => {
  assert.equal(
    createHoursIntroduction(
      [
        { person: 'Marcel', date: '2026-09-02' },
        { person: 'Marcel', date: '2026-08-31' },
        { person: 'Anna', date: '2026-09-01' }
      ],
      'nl'
    ),
    'Hierbij factureren wij de uren van Anna en Marcel over de periode 31 augustus 2026 t/m 2 september 2026.'
  )
})

test('single-day and empty introductions are supported in both languages', () => {
  assert.equal(createHoursIntroduction([], 'nl'), '')
  assert.equal(
    createHoursIntroduction([{ person: 'Marcel', date: '2026-08-31' }], 'nl'),
    'Hierbij factureren wij de uren van Marcel over de periode 31 augustus 2026.'
  )
  assert.match(createHoursIntroduction([{ person: 'Marcel', date: '2026-08-31' }], 'en'), /Marcel.*August 31, 2026/)
})
