import assert from 'node:assert/strict'
import test from 'node:test'
import { getOTPEmailContent } from '../server/utils/email-texts'

test('OTP email subjects use the configured portal brand name', () => {
  assert.equal(
    getOTPEmailContent({ otp: '123456', type: 'sign-in', brandName: 'Ludulicious' }).subject,
    'Your Ludulicious sign-in code'
  )
  assert.equal(
    getOTPEmailContent({ otp: '123456', type: 'password-reset', brandName: 'Ludulicious' }).subject,
    'Reset your Ludulicious password'
  )
})

test('OTP email subjects keep the customer-portal default brand', () => {
  assert.equal(
    getOTPEmailContent({ otp: '123456', type: 'email-verification' }).subject,
    'Verify your Apex Pro email address'
  )
})
