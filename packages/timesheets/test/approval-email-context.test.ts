import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const code = ts.transpileModule(
  readFileSync(new URL('../server/utils/timesheet-approval-email-context.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }
).outputText
const submission = {
  id: 'submission',
  userId: 'submitter',
  organizationId: 'workspace',
  version: 2,
  status: 'SUBMITTED'
}
const reviewer = { id: 'current-approver', name: 'Current Approver', email: 'current@example.com', clientId: 'client' }
const harness = (rows: unknown[][], recipients = [reviewer]) => {
  const exports = {} as typeof import('../server/utils/timesheet-approval-email-context')
  const query = () => {
    const result = rows.shift()
    assert.ok(result, 'Unexpected database query')
    const builder: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'limit', 'orderBy']) {
      builder[method] = () => builder
    }
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return builder
  }
  runInNewContext(code, {
    exports,
    require: (id: string) => {
      if (id.endsWith('/server/portal')) {
        return { db: { select: query } }
      }
      if (id === './timesheet-email-recipients') {
        return { internalEmailRecipients: async () => recipients, clientEmailRecipients: async () => recipients }
      }
      if (id === '../db/schema/timesheets') {
        return require('../server/db/schema/timesheets')
      }
      return require(id)
    }
  })
  return exports.approvalEmailContext
}

test('approval email context rejects inaccessible submissions and unassigned internal actors', async () => {
  await assert.rejects(harness([[]])('other-workspace', 'actor', 'admin', 'submission'), { statusCode: 404 })
  await assert.rejects(harness([[submission], []])('workspace', 'actor', 'admin', 'submission'), { statusCode: 403 })
})

test('client reminders require a provider administrator and an existing review', async () => {
  await assert.rejects(harness([[submission]])('workspace', 'actor', 'member', 'submission', 'client'), {
    statusCode: 403
  })
  await assert.rejects(harness([[submission], []])('workspace', 'actor', 'admin', 'submission', 'client'), {
    statusCode: 404
  })
})

test('internal preview uses current approvers and the last recorded message', async () => {
  const result = await harness([
    [submission],
    [{ id: 'assignment' }],
    [{ internalApprovalsEnabled: true }],
    [{ message: 'Last message' }]
  ])('workspace', 'actor', 'member', 'submission')
  assert.equal(result.context.canResend, true)
  assert.equal(result.context.recipients[0]!.email, reviewer.email)
  assert.equal(result.context.message, 'Last message')
  assert.equal(result.context.version, 2)
})

test('closed internal requests, disabled approvals and missing approvers cannot be resent', async () => {
  for (const status of ['APPROVED', 'REJECTED', 'DRAFT']) {
    const result = await harness([
      [{ ...submission, status }],
      [{ id: 'assignment' }],
      [{ internalApprovalsEnabled: true }],
      []
    ])('workspace', 'actor', 'member', 'submission')
    assert.equal(result.context.canResend, false)
  }
  const disabled = await harness([[submission], [{ id: 'assignment' }], [{ internalApprovalsEnabled: false }], []])(
    'workspace',
    'actor',
    'member',
    'submission'
  )
  assert.equal(disabled.context.canResend, false)
  const missing = await harness([[submission], [{ id: 'assignment' }], [{ internalApprovalsEnabled: true }], []], [])(
    'workspace',
    'actor',
    'member',
    'submission'
  )
  assert.equal(missing.context.canResend, false)
})

test('client preview requires pending review and internal approval and uses the review version', async () => {
  const approved = { ...submission, status: 'APPROVED' }
  const pending = await harness([[approved], [{ status: 'PENDING', version: 4 }], []])(
    'workspace',
    'actor',
    'owner',
    'submission',
    'client'
  )
  assert.equal(pending.context.canResend, true)
  assert.equal(pending.context.version, 4)
  for (const status of ['APPROVED', 'DISPUTED']) {
    const closed = await harness([[approved], [{ status, version: 4 }], []])(
      'workspace',
      'actor',
      'admin',
      'submission',
      'client'
    )
    assert.equal(closed.context.canResend, false)
  }
  const notApproved = await harness([[submission], [{ status: 'PENDING', version: 4 }], []])(
    'workspace',
    'actor',
    'admin',
    'submission',
    'client'
  )
  assert.equal(notApproved.context.canResend, false)
})
