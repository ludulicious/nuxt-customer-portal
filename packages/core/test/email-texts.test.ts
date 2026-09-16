import assert from 'node:assert/strict'
import test from 'node:test'
import { getOTPEmailContent } from '../server/utils/email-texts'
import { renderPortalEmailMarkdown } from '../server/utils/portal-email'
import { emailRecipientName } from '../shared/email-recipient'

test('email recipient name prefers first name and falls back to display name', () => {
  assert.equal(emailRecipientName({ firstName: ' Jenni ', displayName: 'Jenni Iyoyo' }), 'Jenni')
  assert.equal(emailRecipientName({ firstName: ' ', displayName: ' Jenni Iyoyo ' }), 'Jenni Iyoyo')
  assert.equal(emailRecipientName({ displayName: ' ', email: 'jenni@example.test' }), 'jenni@example.test')
})

test('portal email text renders Markdown while allowing exceptional inline HTML', () => {
  const html = renderPortalEmailMarkdown(
    'Hello **there**.\n\n[Open portal](https://example.test)\n\n<span>Custom HTML</span>'
  )
  assert.match(html, /<strong>there<\/strong>/)
  assert.match(html, /<a href="https:\/\/example.test">Open portal<\/a>/)
  assert.match(html, /<span>Custom HTML<\/span>/)
})

test('OTP email subjects use the configured portal brand name', () => {
  assert.equal(
    getOTPEmailContent({ otp: '123456', type: 'sign-in', brandName: 'Ludulicious' }).subject,
    'Your Ludulicious sign-in code'
  )
  assert.equal(
    getOTPEmailContent({ otp: '123456', type: 'forget-password', brandName: 'Ludulicious' }).subject,
    'Reset your Ludulicious password'
  )
  assert.equal(
    getOTPEmailContent({ otp: '123456', type: 'change-email', brandName: 'Ludulicious' }).subject,
    'Confirm your new Ludulicious email address'
  )
})

test('OTP email subjects keep the customer-portal default brand', () => {
  assert.equal(
    getOTPEmailContent({ otp: '123456', type: 'email-verification' }).subject,
    'Verify your Nuxt Customer Portal email address'
  )
})
