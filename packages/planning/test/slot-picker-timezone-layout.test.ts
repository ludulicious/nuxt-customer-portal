import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const picker = readFileSync(new URL('../app/components/PlanningSlotPicker.vue', import.meta.url), 'utf8')

test('timezone selector appears beside month navigation above the booking calendar', () => {
  const headerStart = picker.indexOf('class="booking-calendar-header')
  const calendarStart = picker.indexOf('class="grid grid-cols-7')
  const header = picker.slice(headerStart, calendarStart)
  assert.ok(headerStart > 0 && calendarStart > headerStart)
  assert.match(header, /flex flex-wrap items-center justify-between gap-4/)
  assert.match(header, /planning\.previousMonth/)
  assert.match(header, /planning\.nextMonth/)
  assert.match(header, /planning\.timezone/)
  assert.match(header, /<PlanningTimezoneSelect v-model="timezone" :user-timezone="userTimezone"/)
  assert.equal((picker.match(/<PlanningTimezoneSelect/g) || []).length, 2)
  assert.doesNotMatch(picker, /grid-column: 2/)
})

test('lower selector area is omitted when no team-member choice is needed', () => {
  assert.match(picker, /<div v-if="availableProviders.length > 1" class="booking-selectors">/)
})

test('floating labels stay inside their field bounds so the time-panel scroll container cannot clip them', () => {
  assert.match(picker, /\.border-label-field\s*\{\s*position: relative;\s*padding-top: 8px;/)
  assert.match(picker, /\.border-label-field :deep\(label\)\s*\{\s*position: absolute;\s*top: 0;/)
})

test('time selection exposes the same timezone model and clears a previously selected time on change', () => {
  const timeHeaderStart = picker.indexOf('<div class="mobile-times-heading">')
  const timeSlotsStart = picker.indexOf('<div class="slot-grid')
  const timeHeader = picker.slice(timeHeaderStart, timeSlotsStart)
  assert.match(timeHeader, /planning\.timezone/)
  assert.match(timeHeader, /booking-calendar-header flex w-full flex-wrap items-start justify-between gap-4/)
  assert.ok(timeHeader.indexOf('planning.changeDate') < timeHeader.indexOf('<h3'))
  assert.ok(timeHeader.indexOf('<h3') < timeHeader.indexOf('<PlanningTimezoneSelect'))
  assert.match(timeHeader, /<h3 ref="timesHeading" tabindex="-1" class="self-center whitespace-nowrap font-semibold">/)
  assert.match(timeHeader, /<PlanningTimezoneSelect v-model="timezone" :user-timezone="userTimezone"/)
  assert.doesNotMatch(picker, /planning\.slotTimesTimezone/)
  assert.match(
    picker,
    /watch\(\[timezone, provider, \(\) => props.currency\], \(\) => \{\s*selectedSlot.value = undefined/
  )
})
