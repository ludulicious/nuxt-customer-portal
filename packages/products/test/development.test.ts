import assert from 'node:assert/strict'
import test from 'node:test'
import { developmentSandboxEffectsEnabled } from '../server/utils/development'

test('development sandbox effects require an explicit non-production opt-in', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalDevelopment = process.env.IS_DEVELOPMENT
  try {
    process.env.NODE_ENV = 'development'
    delete process.env.IS_DEVELOPMENT
    assert.equal(developmentSandboxEffectsEnabled(), false)

    process.env.IS_DEVELOPMENT = 'true'
    assert.equal(developmentSandboxEffectsEnabled(), true)

    process.env.NODE_ENV = 'production'
    assert.equal(developmentSandboxEffectsEnabled(), false)

    process.env.NODE_ENV = 'development'
    process.env.IS_DEVELOPMENT = 'TRUE'
    assert.equal(developmentSandboxEffectsEnabled(), false)
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
    if (originalDevelopment === undefined) {
      delete process.env.IS_DEVELOPMENT
    } else {
      process.env.IS_DEVELOPMENT = originalDevelopment
    }
  }
})
