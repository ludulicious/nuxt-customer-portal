import assert from 'node:assert/strict'
import test from 'node:test'
import { canTransitionTenant } from './lifecycle'

test('tenant lifecycle only permits explicit transitions', () => {
  assert.equal(canTransitionTenant('ACTIVE', 'READ_ONLY'), true)
  assert.equal(canTransitionTenant('READ_ONLY', 'ACTIVE'), true)
  assert.equal(canTransitionTenant('ACTIVE', 'DELETED'), false)
  assert.equal(canTransitionTenant('DELETED', 'ACTIVE'), false)
})
