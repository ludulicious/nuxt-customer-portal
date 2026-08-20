import assert from 'node:assert/strict'
import test from 'node:test'
import { canTransitionWorkspace } from './lifecycle'

test('workspace lifecycle only permits explicit transitions', () => {
  assert.equal(canTransitionWorkspace('ACTIVE', 'READ_ONLY'), true)
  assert.equal(canTransitionWorkspace('READ_ONLY', 'ACTIVE'), true)
  assert.equal(canTransitionWorkspace('ACTIVE', 'DELETED'), false)
  assert.equal(canTransitionWorkspace('DELETED', 'ACTIVE'), false)
})
