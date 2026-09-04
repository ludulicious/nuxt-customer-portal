import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { internalApprovalListQuerySchema } from '../server/utils/timesheet-validation'

const listingCode = ts.transpileModule(
  readFileSync(new URL('../server/utils/timesheet-admin-listing.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

test('internal approval listing scopes its queue and filters before counting and paginating', async () => {
  const rows = Array.from({ length: 45 }, (_, index) => ({
    id: String(index).padStart(2, '0'),
    userName: index < 42 ? 'Alice' : 'Bob',
    userId: index < 42 ? 'alice-id' : 'bob-id',
    status: index < 40 ? 'SUBMITTED' : 'APPROVED',
    weekStartsOn: '2026-08-31',
    totalMinutes: index * 60
  }))
  const context = {
    exports: {} as {
      listInternalApprovalsPage: (
        ...args: unknown[]
      ) => Promise<{ items: typeof rows; pagination: { total: number; page: number; pageCount: number } }>
    },
    require: () => ({
      listApprovalQueue: async (organizationId: string, actorUserId: string) => {
        assert.equal(organizationId, 'organization-1')
        assert.equal(actorUserId, 'approver-1')
        return [...rows]
      }
    })
  }
  runInNewContext(listingCode, context)
  const query = internalApprovalListQuerySchema.parse({ search: ' alice ', status: 'SUBMITTED', page: 2 })
  const result = await context.exports.listInternalApprovalsPage('organization-1', 'approver-1', query)
  assert.equal(result.pagination.total, 40)
  assert.equal(result.pagination.pageCount, 2)
  assert.equal(result.items.length, 20)
  assert.equal(result.items[0]?.id, '20')
  const memberResult = await context.exports.listInternalApprovalsPage(
    'organization-1',
    'approver-1',
    internalApprovalListQuerySchema.parse({ userId: 'bob-id', status: 'APPROVED' })
  )
  assert.equal(memberResult.pagination.total, 3)
  assert.ok(memberResult.items.every((item) => item.userId === 'bob-id'))
  for (const sortDir of ['asc', 'desc']) {
    const sorted = await context.exports.listInternalApprovalsPage(
      'organization-1',
      'approver-1',
      internalApprovalListQuerySchema.parse({ sortBy: 'totalMinutes', sortDir })
    )
    assert.equal(sorted.items[0]?.totalMinutes, sortDir === 'asc' ? 0 : 2640)
  }
})

test('internal approval query rejects unsupported statuses and sorting', () => {
  assert.equal(internalApprovalListQuerySchema.safeParse({ status: 'PENDING' }).success, false)
  assert.equal(internalApprovalListQuerySchema.safeParse({ sortBy: 'unknown' }).success, false)
  assert.equal(internalApprovalListQuerySchema.safeParse({ page: 0 }).success, false)
})

test('client approvals filter by member ID before pagination even when names match', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    userId: index < 25 ? 'member-a' : 'member-b',
    person: 'Same name',
    status: 'PENDING',
    weekStartsOn: '2026-09-01'
  }))
  const context = {
    exports: {} as {
      listClientApprovalsPage: (...args: unknown[]) => Promise<{ items: typeof rows; pagination: { total: number } }>
    },
    require: () => ({
      listClientApprovals: async (organizationId: string, actorUserId: string) => {
        assert.equal(organizationId, 'client-org')
        assert.equal(actorUserId, 'reviewer')
        return { items: rows }
      }
    })
  }
  runInNewContext(listingCode, context)
  const result = await context.exports.listClientApprovalsPage('client-org', 'reviewer', false, {
    userId: 'member-b',
    status: 'PENDING',
    sortBy: 'weekStartsOn',
    sortDir: 'desc',
    page: 1,
    pageSize: 20
  })
  assert.equal(result.pagination.total, 5)
  assert.ok(result.items.every((item) => item.userId === 'member-b'))
})
