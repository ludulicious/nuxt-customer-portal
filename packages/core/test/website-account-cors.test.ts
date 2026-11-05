import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp, defineEventHandler, toWebHandler, toWebRequest } from 'h3'
import { betterAuth } from 'better-auth'
import { websiteOriginSchema, websiteOriginsSchema } from '../shared/website-origins'
import { registerWebsiteOriginsResolver, resolveWebsiteOrigins } from '../server/utils/website-origins'
import cors from '../server/middleware/00-website-account-cors'

const origin = 'https://www.marpos.nl'
const portal = 'https://portal.marpos.nl'

test('connected website origins accept exact HTTPS addresses and reject broad or malformed trust', () => {
  assert.deepEqual(websiteOriginsSchema.parse([origin, `${origin}/`]), [origin])
  assert.equal(websiteOriginSchema.parse('http://localhost:3060'), 'http://localhost:3060')
  for (const value of [
    '*',
    'https://*.marpos.nl',
    'null',
    'https://www.marpos.nl/login',
    'https://www.marpos.nl?next=evil',
    'https://www.marpos.nl#login',
    'https://user:secret@www.marpos.nl',
    'http://www.marpos.nl',
    'javascript:alert(1)'
  ]) {
    assert.equal(websiteOriginSchema.safeParse(value).success, false, value)
  }
  assert.equal(
    websiteOriginsSchema.safeParse(Array.from({ length: 21 }, (_, i) => `https://site${i}.example`)).success,
    false
  )
})

test('session and sign-out CORS use current settings, restrict preflights, and preserve authentication', async () => {
  const previous = process.env.PORTAL_AUTH_WEBSITE_ORIGINS
  delete process.env.PORTAL_AUTH_WEBSITE_ORIGINS
  let websites: string[] = []
  let settingsReads = 0
  registerWebsiteOriginsResolver(async () => {
    settingsReads++
    return websites
  })
  try {
    // Initializing Better Auth must not require settings or a migrated database.
    assert.deepEqual(await resolveWebsiteOrigins(false), [])
    assert.equal(settingsReads, 0)
    const auth = betterAuth({
      baseURL: portal,
      secret: 'connected-website-tests-only-secret-at-least-32-characters',
      trustedOrigins: (request) => resolveWebsiteOrigins(Boolean(request)),
      emailAndPassword: { enabled: true },
      session: { cookieCache: { enabled: false } },
      logger: { disabled: true }
    })
    await auth.$context
    assert.equal(settingsReads, 0)
    const app = createApp()
    app.use(cors)
    app.use(
      defineEventHandler((event) => {
        // Test the actual Better Auth transport for session and sign-out responses.
        if (event.path.startsWith('/api/auth/')) {
          return auth.handler(toWebRequest(event))
        }
        return { private: true }
      })
    )
    const request = toWebHandler(app)
    const get = (path = '/api/auth/get-session', website = origin, cookie = '') =>
      request(
        new Request(`${portal}${path}`, {
          headers: { Origin: website, ...(cookie ? { Cookie: cookie } : {}) }
        })
      )
    const preflight = (method = 'POST', website = origin, headers = 'content-type', path = '/api/auth/sign-out') =>
      request(
        new Request(`${portal}${path}`, {
          method: 'OPTIONS',
          headers: {
            Origin: website,
            'Access-Control-Request-Method': method,
            'Access-Control-Request-Headers': headers
          }
        })
      )

    let result = await get()
    assert.equal(result.headers.get('access-control-allow-origin'), null)
    websites = [origin]
    result = await get()
    assert.equal(result.status, 200)
    assert.equal(await result.json(), null)
    assert.equal(result.headers.get('access-control-allow-origin'), origin)
    assert.equal(result.headers.get('access-control-allow-credentials'), 'true')
    assert.match(result.headers.get('vary') || '', /Origin/i)
    assert.match(result.headers.get('cache-control') || '', /no-store/)

    result = await preflight()
    assert.equal(result.status, 204)
    assert.equal(result.headers.get('access-control-allow-methods'), 'POST')
    assert.equal(result.headers.get('access-control-allow-headers'), 'Content-Type')
    assert.equal(result.headers.get('access-control-allow-credentials'), 'true')
    assert.equal((await preflight('GET', origin, '', '/api/auth/get-session')).status, 204)
    for (const denied of [
      await preflight('DELETE'),
      await preflight('POST', 'https://evil.example'),
      await preflight('POST', origin, 'authorization'),
      await preflight('POST', `${origin}.evil.example`)
    ]) {
      assert.equal(denied.status, 403)
      assert.equal(denied.headers.get('access-control-allow-origin'), null)
    }
    assert.equal((await get('/api/invoices')).headers.get('access-control-allow-origin'), null)
    assert.equal((await get('/api/auth/sign-in/email')).headers.get('access-control-allow-origin'), null)
    assert.equal(
      (await get('/api/auth/get-session', 'https://evil.example')).headers.get('access-control-allow-origin'),
      null
    )

    const signup = await auth.api.signUpEmail({
      body: { name: 'Marpos Owner', email: 'owner@example.com', password: 'portal-test-password-only' },
      asResponse: true
    })
    assert.equal(signup.status, 200)
    const cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ')
    assert.ok(cookie)
    result = await get('/api/auth/get-session', origin, cookie)
    assert.equal(result.status, 200)
    assert.equal((await result.json()).user.name, 'Marpos Owner')
    assert.equal(result.headers.get('access-control-allow-origin'), origin)

    result = await request(
      new Request(`${portal}/api/auth/sign-out`, {
        method: 'POST',
        headers: { Origin: 'https://evil.example', Cookie: cookie, 'Content-Type': 'application/json' },
        body: '{}'
      })
    )
    assert.equal(result.status, 403)
    assert.equal((await (await get('/api/auth/get-session', origin, cookie)).json()).user.name, 'Marpos Owner')
    result = await request(
      new Request(`${portal}/api/auth/sign-out`, {
        method: 'POST',
        headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
        body: '{}'
      })
    )
    assert.equal(result.status, 200)
    assert.equal(result.headers.get('access-control-allow-origin'), origin)
    assert.deepEqual(await result.json(), { success: true })
    assert.equal(await (await get('/api/auth/get-session', origin, cookie)).json(), null)

    websites = []
    assert.equal((await get()).headers.get('access-control-allow-origin'), null)
    assert.equal((await preflight()).status, 403)
    // The portal's own origin remains trusted by Better Auth.
    result = await request(
      new Request(`${portal}/api/auth/sign-out`, {
        method: 'POST',
        headers: { Origin: portal, Cookie: 'test=1', 'Content-Type': 'application/json' },
        body: '{}'
      })
    )
    assert.equal(result.status, 200)
    process.env.PORTAL_AUTH_WEBSITE_ORIGINS = origin
    assert.deepEqual(await resolveWebsiteOrigins(), [origin])
    assert.equal((await get()).headers.get('access-control-allow-origin'), origin)
  } finally {
    registerWebsiteOriginsResolver(undefined)
    if (previous === undefined) {
      delete process.env.PORTAL_AUTH_WEBSITE_ORIGINS
    } else {
      process.env.PORTAL_AUTH_WEBSITE_ORIGINS = previous
    }
  }
})

test('environment and stored origins normalize and deduplicate before enforcing the combined limit', async () => {
  const previous = process.env.PORTAL_AUTH_WEBSITE_ORIGINS
  const origins = Array.from({ length: 20 }, (_, index) => `https://site${index}.example`)
  let stored = origins.map((value) => `${value}/`)
  process.env.PORTAL_AUTH_WEBSITE_ORIGINS = origins.join(',')
  registerWebsiteOriginsResolver(async () => stored)
  try {
    assert.deepEqual(await resolveWebsiteOrigins(), origins)
    stored = ['https://another.example']
    await assert.rejects(resolveWebsiteOrigins())
    assert.deepEqual(await resolveWebsiteOrigins(false), origins)
    process.env.PORTAL_AUTH_WEBSITE_ORIGINS = 'https://*.example'
    await assert.rejects(resolveWebsiteOrigins())
  } finally {
    registerWebsiteOriginsResolver(undefined)
    if (previous === undefined) {
      delete process.env.PORTAL_AUTH_WEBSITE_ORIGINS
    } else {
      process.env.PORTAL_AUTH_WEBSITE_ORIGINS = previous
    }
  }
})
