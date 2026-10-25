import assert from 'node:assert/strict'
import test from 'node:test'
import type { Order } from '../shared/types'
import { purchaseAppointments } from '../server/utils/purchase-appointments'
import { registerPlanningOrderIntegration } from '../server/utils/contracts'

const order = {
  status: 'paid',
  total: 2000,
  refunded: 0,
  disputed: false,
  lines: [
    { id: 'paid', total: 1000, refunded: 0 },
    { id: 'refunded', total: 1000, refunded: 1000 }
  ]
} as Order

test('purchase appointments support products installations without planning', async () => {
  assert.deepEqual(await purchaseAppointments(order), [])
})

test('purchase appointments respect order and line access for paid, free and invoice orders', async () => {
  const appointment = {
    id: 'appointment',
    orderLineId: 'paid',
    title: 'Session',
    start: '2026-10-24T09:00:00Z',
    end: '2026-10-24T10:00:00Z',
    timezone: 'Europe/Amsterdam',
    status: 'confirmed' as const
  }
  let reads = 0
  registerPlanningOrderIntegration({
    prepareCheckout: async () => {},
    bind: async () => {},
    prepareOrder: async () => {},
    confirm: async () => {},
    purchaseAppointments: async () => {
      reads++
      return [appointment, { ...appointment, orderLineId: 'refunded' }, { ...appointment, orderLineId: 'unrelated' }]
    }
  })
  assert.deepEqual(await purchaseAppointments(order), [appointment])
  assert.deepEqual(await purchaseAppointments({ ...order, status: 'accepted' }), [appointment])
  assert.deepEqual(
    await purchaseAppointments({ ...order, total: 0, lines: [{ id: 'paid', total: 0, refunded: 0 }] } as Order),
    [appointment]
  )
  const before = reads
  for (const state of [
    { status: 'pending' as const },
    { status: 'failed' as const },
    { status: 'expired' as const },
    { disputed: true },
    { refunded: 2000 }
  ]) {
    assert.deepEqual(await purchaseAppointments({ ...order, ...state }), [])
  }
  assert.equal(reads, before)
})
