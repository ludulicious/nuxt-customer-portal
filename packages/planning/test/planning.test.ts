import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultPlanningPolicy, effectivePolicy, productPlanningSchema } from '../../products/shared/planning'
import { productSchema, emptyProduct } from '../../products/shared/validation'
import { generateSlots, localParts, canChange, changeFee, refundAmount } from '../shared/availability'
import { availabilitySchema } from '../shared/validation'
import { calendarInvitation } from '../shared/invitation'
import { encrypt, decrypt } from '../server/utils/crypto'
import type { AvailabilityWindow } from '../shared/types'

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
test('credentials are authenticated encrypted data and require a dedicated key', () => {
  const old = process.env.PLANNING_ENCRYPTION_KEY
  process.env.PLANNING_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
  try {
    const encrypted = encrypt({ access_token: 'secret' })
    assert.ok(!encrypted.includes('secret'))
    assert.deepEqual(decrypt(encrypted), { access_token: 'secret' })
    const bytes = Buffer.from(encrypted, 'base64')
    bytes[30] ^= 1
    assert.throws(() => decrypt(bytes.toString('base64')))
  } finally {
    if (old) {
      process.env.PLANNING_ENCRYPTION_KEY = old
    } else {
      delete process.env.PLANNING_ENCRYPTION_KEY
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
