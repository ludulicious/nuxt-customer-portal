import assert from 'node:assert/strict'
import test from 'node:test'
import type { H3Event } from 'h3'
import { socialAuthProviderEnabled, socialAuthProviders } from '../shared/social-auth'

test('social authentication requires an explicit opt-in and both credentials', () => {
  assert.equal(socialAuthProviderEnabled(undefined, 'client-id', 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('false', 'client-id', 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('true', undefined, 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('true', 'client-id', undefined), false)
  assert.equal(socialAuthProviderEnabled('true', ' ', 'client-secret'), false)
  assert.equal(socialAuthProviderEnabled('true', 'client-id', ' '), false)
  assert.equal(socialAuthProviderEnabled('true', 'client-id', 'client-secret'), true)
})

test('provider availability exposes only booleans and treats providers independently', () => {
  assert.deepEqual(
    socialAuthProviders({
      PORTAL_GOOGLE_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'private-client-id',
      GOOGLE_CLIENT_SECRET: 'private-client-secret',
      PORTAL_GITHUB_ENABLED: 'false',
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret'
    }),
    { googleEnabled: true, githubEnabled: false }
  )
})

test('request config replaces stale build defaults and public overrides with runtime availability', async () => {
  const handler = (await import('../server/middleware/social-auth-config')).default
  const variables = [
    'PORTAL_GOOGLE_ENABLED',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'PORTAL_GITHUB_ENABLED',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET'
  ]
  const previousEnv = variables.map((key) => [key, process.env[key]] as const)
  const builtConfig = { public: { portalAuth: { googleEnabled: false, githubEnabled: false, termsUrl: '/terms' } } }
  let requestConfig = structuredClone(builtConfig)
  const runtime = globalThis as typeof globalThis & { useRuntimeConfig?: (event: H3Event) => typeof requestConfig }
  const previousRuntime = runtime.useRuntimeConfig
  runtime.useRuntimeConfig = () => requestConfig
  try {
    for (const key of variables) {
      Reflect.deleteProperty(process.env, key)
    }
    Object.assign(process.env, {
      PORTAL_GOOGLE_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'runtime-client-id',
      GOOGLE_CLIENT_SECRET: 'runtime-client-secret'
    })
    await handler({} as H3Event)
    assert.deepEqual(requestConfig.public.portalAuth, {
      googleEnabled: true,
      githubEnabled: false,
      termsUrl: '/terms'
    })
    assert.equal(builtConfig.public.portalAuth.googleEnabled, false)
    for (const env of [
      { PORTAL_GOOGLE_ENABLED: 'false', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' },
      { PORTAL_GOOGLE_ENABLED: 'true', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: 'secret' },
      { PORTAL_GOOGLE_ENABLED: 'true', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: ' ' }
    ]) {
      Object.assign(process.env, env)
      // An old public override must not advertise an unavailable server provider.
      requestConfig = structuredClone(builtConfig)
      requestConfig.public.portalAuth.googleEnabled = true
      await handler({} as H3Event)
      assert.equal(requestConfig.public.portalAuth.googleEnabled, false)
    }
  } finally {
    runtime.useRuntimeConfig = previousRuntime
    for (const [key, value] of previousEnv) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key)
      } else {
        process.env[key] = value
      }
    }
  }
})
