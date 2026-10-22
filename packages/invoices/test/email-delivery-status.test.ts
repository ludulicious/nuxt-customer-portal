import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRefreshInvoiceEmailStatus } from '../shared/email-delivery-status'

const now = Date.parse('2026-10-22T12:00:00Z')
const minute = 60_000
const day = 24 * 60 * minute
const delivery = {
  providerMessageId: 'message-id',
  providerLastEvent: 'sent',
  providerStatusCheckedAt: null as string | null,
  sentAt: new Date(now - 10 * minute).toISOString(),
  createdAt: new Date(now - 10 * minute).toISOString()
}

test('completed delivery outcomes never trigger automatic provider lookups', () => {
  for (const event of [
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'failed',
    'suppressed',
    'complained',
    ' Email.Delivered '
  ]) {
    assert.equal(shouldRefreshInvoiceEmailStatus({ ...delivery, providerLastEvent: event }, false, now), false, event)
  }
})

test('manual refresh can retrieve later events after delivery but respects a one-minute cooldown', () => {
  const completed = { ...delivery, providerLastEvent: 'delivered' }
  assert.equal(shouldRefreshInvoiceEmailStatus(completed, true, now), true)
  assert.equal(
    shouldRefreshInvoiceEmailStatus(
      { ...completed, providerStatusCheckedAt: new Date(now - 59_999).toISOString() },
      true,
      now
    ),
    false
  )
  assert.equal(
    shouldRefreshInvoiceEmailStatus(
      { ...completed, providerStatusCheckedAt: new Date(now - minute).toISOString() },
      true,
      now
    ),
    true
  )
})

test('missing provider IDs are never looked up, even manually', () => {
  assert.equal(shouldRefreshInvoiceEmailStatus({ ...delivery, providerMessageId: null }, false, now), false)
  assert.equal(shouldRefreshInvoiceEmailStatus({ ...delivery, providerMessageId: null }, true, now), false)
})

test('unresolved emails without a previous attempt are checked', () => {
  for (const event of [null, 'sent', 'delivery_delayed', 'new_provider_event']) {
    assert.equal(shouldRefreshInvoiceEmailStatus({ ...delivery, providerLastEvent: event }, false, now), true)
  }
})

test('unresolved emails use five-minute, hourly and daily intervals according to age', () => {
  for (const [age, interval] of [
    [10 * minute, 5 * minute],
    [day, 60 * minute],
    [7 * day, day]
  ] as const) {
    const pending = { ...delivery, sentAt: new Date(now - age).toISOString() }
    assert.equal(
      shouldRefreshInvoiceEmailStatus(
        { ...pending, providerStatusCheckedAt: new Date(now - interval + 1).toISOString() },
        false,
        now
      ),
      false
    )
    assert.equal(
      shouldRefreshInvoiceEmailStatus(
        { ...pending, providerStatusCheckedAt: new Date(now - interval).toISOString() },
        false,
        now
      ),
      true
    )
  }
})

test('a recorded failed attempt prevents immediate retries without clearing the known event', () => {
  const failedAttempt = { ...delivery, providerStatusCheckedAt: new Date(now).toISOString() }
  assert.equal(shouldRefreshInvoiceEmailStatus(failedAttempt, false, now), false)
  assert.equal(shouldRefreshInvoiceEmailStatus(failedAttempt, true, now), false)
  assert.equal(shouldRefreshInvoiceEmailStatus(failedAttempt, false, now + 5 * minute), true)
})

test('database Date values and missing sent timestamps use the same policy', () => {
  const databaseDelivery = {
    ...delivery,
    sentAt: null,
    createdAt: new Date(now - day),
    providerStatusCheckedAt: new Date(now - 5 * minute)
  }
  assert.equal(shouldRefreshInvoiceEmailStatus(databaseDelivery, false, now), false)
  assert.equal(shouldRefreshInvoiceEmailStatus(databaseDelivery, true, now), true)
})
