import assert from 'node:assert/strict'
import test from 'node:test'
import { selectClientDashboardApprovals } from '../shared/client-approval-dashboard'

test('dashboard includes all actionable pending items and only the five latest personal approvals', () => {
  const approved = Array.from({ length: 7 }, (_, index) => ({
    id: `approved-${index}`,
    status: 'APPROVED' as const,
    canAct: false,
    periodEndsOn: '2026-08-01',
    reviewerUserId: 'current-user',
    reviewedAt: `2026-09-0${index + 1}T12:00:00.000Z`
  }))
  const pending = Array.from({ length: 6 }, (_, index) => ({
    ...approved[0]!,
    id: `pending-${index}`,
    status: 'PENDING' as const,
    canAct: true,
    reviewedAt: null,
    reviewerUserId: null
  }))
  const result = selectClientDashboardApprovals(
    [
      ...approved,
      ...pending,
      { ...approved[0]!, id: 'other-user', reviewerUserId: 'someone-else' },
      { ...pending[0]!, id: 'not-actionable', canAct: false },
      { ...approved[0]!, id: 'disputed', status: 'DISPUTED' as const }
    ],
    'current-user'
  )
  assert.equal(result.pendingCount, 6)
  assert.equal(result.hasHistory, true)
  assert.deepEqual(
    result.items.map((item) => item.id),
    [...pending.map((item) => item.id), 'approved-6', 'approved-5', 'approved-4', 'approved-3', 'approved-2']
  )
  assert.deepEqual(selectClientDashboardApprovals([], 'current-user'), {
    pendingCount: 0,
    hasHistory: false,
    items: []
  })
  const historyOnly = selectClientDashboardApprovals(approved, 'current-user')
  assert.equal(historyOnly.pendingCount, 0)
  assert.equal(historyOnly.hasHistory, true)
  assert.equal(historyOnly.items.length, 5)
})
