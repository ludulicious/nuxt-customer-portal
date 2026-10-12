import assert from 'node:assert/strict'
import test from 'node:test'
import {
  approvalEmailRecipientsMatch,
  approvalEmailResendSchema,
  fillApprovalEmailDraft
} from '../shared/approval-email'

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
  assert.equal(approvalEmailResendSchema.safeParse({ ...valid, message: '' }).success, false)
  for (const invalid of [
    { version: 0 },
    { recipients: [] },
    { requestId: 'wildcard%' },
    { message: 'x'.repeat(50001) },
    { recipients: [{ id: 'a', email: 'invalid' }] }
  ]) {
    assert.equal(approvalEmailResendSchema.safeParse({ ...valid, ...invalid }).success, false)
  }
})

test('template drafts fill timesheet values and retain per-recipient personalization', () => {
  assert.equal(
    fillApprovalEmailDraft(
      'Dear {{recipient_name}}, {{person_name}}: {{period}}. {{comment}} [Review]({{action_url}})',
      { person_name: 'Alex & Co', period: 'October', comment: '', action_url: 'https://portal.example/review?a=1&b=2' }
    ),
    'Dear {{recipient_name}}, Alex &amp; Co: October.  [Review](https://portal.example/review?a=1&amp;b=2)'
  )
  assert.equal(
    fillApprovalEmailDraft('Dear {{recipient_name}}', { recipient_name: 'Current Approver' }),
    'Dear Current Approver'
  )
})
