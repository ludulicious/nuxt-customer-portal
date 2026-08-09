import assert from 'node:assert/strict'
import test from 'node:test'
import { getOTPEmailContent } from '../server/utils/email-texts'

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
