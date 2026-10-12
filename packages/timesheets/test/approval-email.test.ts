import assert from 'node:assert/strict'
import test from 'node:test'
import { approvalEmailRecipientsMatch, approvalEmailResendSchema } from '../shared/approval-email'

const recipients = [
  { id: 'approver-a', email: 'a@example.com' },
  { id: 'approver-b', email: 'b@example.com' }
]

test('resend requires the current recipients, independently of display order', () => {
  assert.equal(approvalEmailRecipientsMatch(recipients, [...recipients].reverse()), true)
  assert.equal(approvalEmailRecipientsMatch(recipients, recipients.slice(1)), false)
  assert.equal(approvalEmailRecipientsMatch(recipients, [recipients[0]!, recipients[0]!]), false)
  assert.equal(
    approvalEmailRecipientsMatch(recipients, [recipients[0]!, { id: 'approver-b', email: 'changed@example.com' }]),
    false
  )
  assert.equal(
    approvalEmailRecipientsMatch(recipients, [recipients[0]!, { id: 'new-approver', email: 'b@example.com' }]),
    false
  )
})

test('resend validates request identity, version, recipients and editable message', () => {
  const valid = {
    version: 1,
    requestId: '00000000-0000-4000-8000-000000000001',
    recipients,
    message: '  Please review the updated hours.  '
  }
  assert.equal(approvalEmailResendSchema.parse(valid).message, 'Please review the updated hours.')
  assert.equal(approvalEmailResendSchema.safeParse({ ...valid, message: '' }).success, true)
  for (const invalid of [
    { version: 0 },
    { recipients: [] },
    { requestId: 'wildcard%' },
    { message: 'x'.repeat(5001) },
    { recipients: [{ id: 'a', email: 'invalid' }] }
  ]) {
    assert.equal(approvalEmailResendSchema.safeParse({ ...valid, ...invalid }).success, false)
  }
})
