import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultPlanningPolicy, effectivePolicy, productPlanningSchema } from '../../products/shared/planning'
import { productSchema, emptyProduct } from '../../products/shared/validation'
import {
  generateSlots,
  isDisplaySlot,
  localParts,
  canChange,
  changeFee,
  refundAmount,
  calendarWallDateTime
} from '../shared/availability'
import { availabilitySchema, holdSchema, holdCredentialSchema, providerSettingsSchema } from '../shared/validation'
import { calendarInvitation } from '../shared/invitation'
import { appointmentCalendarDescription, appointmentCalendarTitle } from '../shared/appointment-calendar'
import { encrypt, decrypt } from '../server/utils/crypto'
import type { AvailabilityWindow } from '../shared/types'

test('provider settings allow no additional calendars', () => {
  const result = providerSettingsSchema.safeParse({
    timezone: 'Europe/Amsterdam',
    graceMinutes: 0,
    availabilityCalendarTitle: 'Portal availability',
    busyCalendarIds: [],
    writeCalendarId: 'primary-calendar'
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.availabilitySyncEnabled, true)
})

test('appointment calendar descriptions include the tooltip client and timezone details', () => {
  const billing = {
    type: 'person' as const,
    firstName: 'Jenni',
    lastName: 'Iyoyo van AGC',
    name: 'Jenni Iyoyo van AGC',
    email: 'jenni@marpos.nl',
    company: '',
    address: '',
    country: 'US',
    registrationNumber: '',
    vatNumber: ''
  }
  const description = appointmentCalendarDescription({
    start: new Date('2026-09-17T19:00:00.000Z'),
    end: new Date('2026-09-17T19:30:00.000Z'),
    providerTimezone: 'Europe/Amsterdam',
    customerTimezone: 'Europe/London',
    locale: 'en',
    billing,
    email: 'jenni@marpos.nl',
    meetingUrl: 'https://example.test/meeting',
    graceMinutes: 0
  })

  assert.match(description, /Appointment time:\nEurope\/Amsterdam/)
  assert.match(description, /Client:\nJenni Iyoyo van AGC\njenni@marpos.nl\nUnited States/)
  assert.match(description, /Client time:\nEurope\/London/)
  assert.match(description, /September 17, 2026/)
  assert.match(description, /https:\/\/example.test\/meeting/)
  assert.match(description, /0 minutes grace time/)
  assert.equal(appointmentCalendarTitle('Discover Yourself', billing), 'Jenni Iyoyo van AGC - Discover Yourself')
  assert.equal(
    appointmentCalendarTitle('Discover Yourself', { ...billing, name: '', firstName: '', lastName: '' }),
    'Discover Yourself'
  )
})

test('display slots stay clock-aligned when notice removes earlier starts', () => {
  const slot = (time: string) => ({
    start: `2026-09-15T${time}:00Z`,
    end: new Date(Date.parse(`2026-09-15T${time}:00Z`) + 3600000).toISOString(),
    providerUserId: 'provider',
    providerName: 'Provider'
  })
  assert.equal(isDisplaySlot(slot('07:15'), 'Europe/Amsterdam'), false)
  assert.equal(isDisplaySlot(slot('07:30'), 'Europe/Amsterdam'), true)
  assert.equal(isDisplaySlot(slot('07:45'), 'Europe/Amsterdam'), false)
  assert.equal(isDisplaySlot(slot('08:00'), 'Europe/Amsterdam'), true)
  assert.equal(isDisplaySlot(slot('07:15'), 'Europe/Amsterdam', 15), true)
  assert.equal(isDisplaySlot(slot('07:30'), 'Europe/Amsterdam', 60), false)
  assert.equal(isDisplaySlot(slot('08:00'), 'Europe/Amsterdam', 60), true)
})

test('hold release and replacement require bounded opaque credentials', () => {
  assert.equal(holdCredentialSchema.safeParse({ holdToken: 'short' }).success, false)
  assert.equal(holdCredentialSchema.safeParse({ holdToken: 'x'.repeat(201) }).success, false)
  assert.equal(holdCredentialSchema.safeParse({ holdToken: 'x'.repeat(43) }).success, true)
  const hold = {
    productId: 'service',
    providerUserId: 'provider',
    start: '2026-09-29T20:30:00Z',
    customerTimezone: 'Europe/Amsterdam',
    currency: 'USD'
  }
  assert.equal(holdSchema.safeParse(hold).success, true)
  assert.equal(holdSchema.safeParse({ ...hold, previousHoldToken: 'short' }).success, false)
  assert.equal(holdSchema.safeParse({ ...hold, previousHoldToken: 'x'.repeat(43) }).success, true)
})

const window: AvailabilityWindow = {
  id: 'window',
  userId: 'provider',
  timezone: 'Europe/Amsterdam',
  date: '2026-09-14',
  endDate: null,
  startTime: '09:00',
  endTime: '12:00',
  recurring: false,
  productIds: null,
  exceptions: []
}
const input = {
  from: new Date('2026-09-14T00:00:00Z'),
  to: new Date('2026-09-15T00:00:00Z'),
  now: new Date('2026-09-13T00:00:00Z'),
  durationMinutes: 60,
  graceMinutes: 0,
  intervalMinutes: 15,
  noticeMinutes: 0,
  horizonDays: 90,
  productId: 'service',
  providerUserId: 'provider',
  providerName: 'Provider',
  windows: [window],
  busy: []
}
test('planning defaults and product overrides keep cancellation opt-in', () => {
  const defaults = defaultPlanningPolicy()
  assert.equal(defaults.reservationMinutes, 60)
  assert.equal(defaults.freeChanges, 1)
  assert.equal(defaults.cancellationEnabled, false)
  assert.equal(effectivePolicy(defaults, { minimumNoticeMinutes: 30 }).reservationMinutes, 60)
  assert.equal(defaults.minimumNoticeMinutes, 1440)
})
test('only services can be plannable, including free services, with a duration and provider', () => {
  assert.equal(productPlanningSchema.safeParse({ enabled: true }).success, false)
  const product = {
    ...emptyProduct(),
    type: 'service',
    isFree: true,
    slug: 'appointment',
    content: {
      en: { title: 'Service', summary: '', description: '' },
      nl: { title: '', summary: '', description: '' }
    },
    planning: { enabled: true, durationMinutes: 60, providerUserIds: ['provider'] }
  }
  assert.equal(productSchema.safeParse(product).success, true)
  assert.equal(productSchema.safeParse({ ...product, type: 'digital' }).success, false)
  assert.equal(
    productSchema.safeParse({ ...product, planning: { ...product.planning, durationMinutes: 0 } }).success,
    false
  )
})
test('availability validates real dates and time order', () => {
  assert.equal(
    availabilitySchema.safeParse({ date: '2026-02-30', startTime: '09:00', endTime: '10:00' }).success,
    false
  )
  assert.equal(
    availabilitySchema.safeParse({ date: '2026-09-14', startTime: '10:00', endTime: '09:00' }).success,
    false
  )
})
test('provider local availability fits whole duration and filters selected products', () => {
  const slots = generateSlots(input)
  assert.equal(slots[0]!.start, '2026-09-14T07:00:00.000Z')
  assert.equal(slots.at(-1)!.start, '2026-09-14T09:00:00.000Z')
  assert.equal(generateSlots({ ...input, windows: [{ ...window, productIds: ['other'] }] }).length, 0)
})
test('weekly windows include future assignments, end dates and occurrence exceptions', () => {
  const recurring = { ...window, recurring: true, endDate: '2026-09-28' }
  const next = {
    ...input,
    from: new Date('2026-09-21T00:00:00Z'),
    to: new Date('2026-09-22T00:00:00Z'),
    windows: [recurring]
  }
  assert.ok(generateSlots(next).length)
  assert.equal(generateSlots({ ...next, windows: [{ ...recurring, exceptions: ['2026-09-21'] }] }).length, 0)
  assert.equal(
    generateSlots({ ...next, from: new Date('2026-10-05T00:00:00Z'), to: new Date('2026-10-06T00:00:00Z') }).length,
    0
  )
})
test('busy events get no additional buffer; portal bookings and holds protect their after-grace interval', () => {
  const busy = [{ start: '2026-09-14T08:00:00Z', end: '2026-09-14T09:00:00Z' }]
  const slots = generateSlots({ ...input, busy, graceMinutes: 15 })
  assert.ok(!slots.some((s) => s.start === '2026-09-14T07:00:00.000Z'))
  assert.ok(slots.some((s) => s.start === '2026-09-14T09:00:00.000Z'))
  const protectedPortal = [{ start: '2026-09-14T08:00:00Z', end: '2026-09-14T09:15:00Z' }]
  assert.ok(!generateSlots({ ...input, busy: protectedPortal }).some((s) => s.start === '2026-09-14T09:00:00.000Z'))
})
test('spring DST skips nonexistent wall times and autumn DST preserves distinct instants', () => {
  const spring = generateSlots({
    ...input,
    from: new Date('2026-03-29T00:00:00Z'),
    to: new Date('2026-03-29T05:00:00Z'),
    now: new Date('2026-03-28T00:00:00Z'),
    durationMinutes: 30,
    windows: [{ ...window, date: '2026-03-29', startTime: '01:00', endTime: '05:00' }]
  })
  assert.ok(spring.length)
  assert.ok(spring.every((s) => !localParts(new Date(s.start), window.timezone).time.startsWith('02:')))
  const autumn = generateSlots({
    ...input,
    from: new Date('2026-10-25T00:00:00Z'),
    to: new Date('2026-10-25T05:00:00Z'),
    now: new Date('2026-10-24T00:00:00Z'),
    durationMinutes: 30,
    windows: [{ ...window, date: '2026-10-25', startTime: '01:00', endTime: '05:00' }]
  })
  assert.equal(autumn.filter((s) => localParts(new Date(s.start), window.timezone).time === '02:00').length, 2)
  assert.equal(new Set(autumn.map((s) => s.start)).size, autumn.length)
})
test('cutoffs, change fees and refunds enforce policy boundaries', () => {
  assert.equal(canChange(new Date('2026-09-15T12:00:00Z'), new Date('2026-09-14T12:00:00Z'), 1440), true)
  assert.equal(canChange(new Date('2026-09-15T12:00:00Z'), new Date('2026-09-14T12:01:00Z'), 1440), false)
  assert.equal(changeFee(0, 1, {}, 'EUR'), 0)
  assert.equal(changeFee(1, 1, { EUR: 2500 }, 'EUR'), 2500)
  assert.throws(() => changeFee(1, 1, {}, 'USD'))
  assert.equal(refundAmount(10000, 8000, 50), 2000)
  assert.equal(refundAmount(10000, 10000, 100), 0)
})
test('credentials are authenticated encrypted data and use the portal key by default', () => {
  const oldRoot = process.env.PORTAL_ENCRYPTION_KEY
  const oldPlanning = process.env.PLANNING_ENCRYPTION_KEY
  delete process.env.PLANNING_ENCRYPTION_KEY
  process.env.PORTAL_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
  try {
    const encrypted = encrypt({ access_token: 'secret' })
    assert.ok(!encrypted.includes('secret'))
    assert.deepEqual(decrypt(encrypted), { access_token: 'secret' })
    const parts = encrypted.split('.')
    parts[4] = `${parts[4]!.startsWith('A') ? 'B' : 'A'}${parts[4]!.slice(1)}`
    assert.throws(() => decrypt(parts.join('.')))
  } finally {
    if (oldRoot === undefined) {
      delete process.env.PORTAL_ENCRYPTION_KEY
    } else {
      process.env.PORTAL_ENCRYPTION_KEY = oldRoot
    }
    if (oldPlanning === undefined) {
      delete process.env.PLANNING_ENCRYPTION_KEY
    } else {
      process.env.PLANNING_ENCRYPTION_KEY = oldPlanning
    }
  }
})
test('invitations preserve UID, sequence, UTF-8 folding and cancellation method', () => {
  const base = {
    id: 'id',
    revision: 1,
    title: 'Service, with; details\n' + 'é'.repeat(100),
    start: input.from,
    end: input.to,
    organizer: 'provider@example.com',
    attendee: 'customer@example.com',
    cancelled: false
  }
  const first = calendarInvitation(base),
    cancel = calendarInvitation({ ...base, revision: 2, cancelled: true })
  assert.match(first, /METHOD:REQUEST/)
  assert.match(cancel, /METHOD:CANCEL/)
  assert.match(cancel, /SEQUENCE:2/)
  assert.match(cancel, /UID:id@portal-planning/)
  assert.ok(first.split('\r\n').every((line) => Buffer.byteLength(line) <= 75))
  assert.match(first.replace(/\r\n /g, ''), /Service\\, with\\; details\\n/)
})

test('empty product policy overrides inherit organization policy after validation', () => {
  const planning = productPlanningSchema.parse({
    enabled: true,
    durationMinutes: 61,
    providerUserIds: ['member'],
    policyOverrides: {}
  })
  assert.deepEqual(planning.policyOverrides, {})
  const policy = effectivePolicy(
    { ...defaultPlanningPolicy(), cancellationEnabled: true, changeFees: { EUR: 2500 } },
    planning.policyOverrides
  )
  assert.equal(policy.cancellationEnabled, true)
  assert.deepEqual(policy.changeFees, { EUR: 2500 })
})

test('midnight availability includes a 90-minute appointment ending at midnight', () => {
  assert.equal(calendarWallDateTime('2026-09-15', '19:00'), '2026-09-15T19:00:00')
  assert.equal(calendarWallDateTime('2026-09-15', '24:00'), '2026-09-16T00:00:00')
  assert.equal(availabilitySchema.parse({ date: window.date, startTime: '19:00', endTime: '00:00' }).endTime, '24:00')
  const slots = generateSlots({
    ...input,
    durationMinutes: 90,
    windows: [{ ...window, startTime: '19:00', endTime: '24:00' }]
  })
  assert.ok(slots.some((slot) => slot.start === '2026-09-14T20:30:00.000Z' && slot.end === '2026-09-14T22:00:00.000Z'))
  const shorter = generateSlots({
    ...input,
    durationMinutes: 90,
    windows: [{ ...window, startTime: '19:00', endTime: '23:59' }]
  })
  assert.ok(!shorter.some((slot) => slot.start === '2026-09-14T20:30:00.000Z'))
})
