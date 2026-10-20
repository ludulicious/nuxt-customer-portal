import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { googleCalendarScopes, hasGoogleCalendarPermissions } from '../shared/google-permissions'

const calendar = 'https://www.googleapis.com/auth/calendar'
test('Google authorization requires read, write, list and busy permissions', () => {
  assert.equal(hasGoogleCalendarPermissions(undefined), false)
  assert.equal(hasGoogleCalendarPermissions('openid email'), false)
  for (let i = 0; i < googleCalendarScopes.length; i++) {
    assert.equal(hasGoogleCalendarPermissions(googleCalendarScopes.filter((_, index) => index !== i).join(' ')), false)
  }
  assert.equal(hasGoogleCalendarPermissions(googleCalendarScopes.join(' ')), true)
  assert.equal(hasGoogleCalendarPermissions(calendar), true)
  assert.equal(hasGoogleCalendarPermissions(`${calendar}.readonly`), false)
  assert.equal(hasGoogleCalendarPermissions(`${calendar}.events ${calendar}.readonly`), true)
})

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../server/utils/oauth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
function harness(scope: string) {
  const writes: unknown[] = []
  const redirects: string[] = []
  const exports = {} as typeof import('../server/utils/oauth')
  runInNewContext(source, {
    exports,
    URLSearchParams,
    AbortSignal,
    fetch: async (url: string) => {
      redirects.push(url)
      return { ok: true, json: async () => ({ sub: 'google-user' }) }
    },
    require: (id: string) => {
      if (id.endsWith('/google-permissions')) {
        return { googleCalendarScopes, hasGoogleCalendarPermissions }
      }
      if (id === 'h3') {
        return {
          getCookie: () => 'binding',
          deleteCookie: () => {},
          setCookie: () => {},
          createError: (value: object) => Object.assign(new Error('Authorization rejected'), value)
        }
      }
      if (id.endsWith('/database')) {
        return {
          rows: async (sql: string, values: unknown[]) => {
            if (sql.startsWith('DELETE')) {
              return [{ id: 'state' }]
            }
            writes.push(values)
            return []
          }
        }
      }
      if (id === './access') {
        return { providerAccess: async () => ({ storeId: 'store', userId: 'user' }) }
      }
      if (id === './adapters') {
        return {
          exchange: async () => ({
            access_token: 'token',
            refresh_token: 'refresh',
            expiresAt: Date.now() + 3600000,
            scope
          })
        }
      }
      if (id === './crypto') {
        return { digest: () => 'digest', encrypt: () => 'encrypted' }
      }
      return require(id)
    }
  })
  return { finish: exports.finishOAuth, writes, redirects }
}
test('partial consent rejects before identifying or overwriting the saved connection', async () => {
  const h = harness('openid email')
  await assert.rejects(
    h.finish({} as never, 'google', 'state', 'code'),
    (error: { data?: { reason?: string } }) => error.data?.reason === 'permissions'
  )
  assert.equal(h.writes.length, 0)
  assert.equal(h.redirects.length, 0)
})
test('complete consent saves the new connection after identifying its owner', async () => {
  const h = harness(googleCalendarScopes.join(' '))
  await h.finish({} as never, 'google', 'state', 'code')
  assert.equal(h.writes.length, 1)
  assert.equal(h.redirects.length, 1)
})

const adapterSource = ts.transpileModule(
  readFileSync(new URL('../server/utils/adapters.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }
).outputText
function calendarHarness(status: number, payload: unknown, healthy = true) {
  const updates: unknown[][] = []
  const exports = {} as typeof import('../server/utils/adapters')
  runInNewContext(adapterSource, {
    exports,
    URLSearchParams,
    AbortSignal,
    fetch: async () => ({ ok: status === 200, status, json: async () => payload }),
    require: (id: string) => {
      if (id.endsWith('/utils/db')) {
        return { pool: { connect: async () => ({ query: async () => {}, release: () => {} }) } }
      }
      if (id.endsWith('/database')) {
        return {
          rows: async (sql: string, values: unknown[]) => {
            if (sql.startsWith('SELECT credentials')) {
              return [{ credentials: 'encrypted', healthy }]
            }
            updates.push(values)
            return []
          }
        }
      }
      if (id.endsWith('/utils/access')) {
        return { baseUrl: () => 'https://portal.example' }
      }
      if (id === './crypto') {
        return { decrypt: () => ({ access_token: 'token', refresh_token: 'refresh', expiresAt: Date.now() + 3600000 }) }
      }
      if (id.endsWith('/availability')) {
        return {}
      }
      return require(id)
    }
  })
  return { calendars: () => exports.googleCalendar.calendars('store', 'user'), updates }
}
test('missing Calendar permissions marks an existing connection as needing reauthorization', async () => {
  const h = calendarHarness(403, {
    error: { message: 'Insufficient Permission', errors: [{ reason: 'insufficientPermissions' }] }
  })
  await assert.rejects(h.calendars(), /403/)
  assert.equal(h.updates.length, 1)
  assert.equal(h.updates[0]![3], 'Calendar permissions missing; reconnect')
})
test('transient Google failures and unrelated forbidden responses do not disconnect the account', async () => {
  for (const status of [403, 429, 500, 503]) {
    const h = calendarHarness(status, {
      error: { message: 'Temporary failure', errors: [{ reason: 'rateLimitExceeded' }] }
    })
    await assert.rejects(h.calendars())
    assert.equal(h.updates.length, 0)
  }
})
test('revoked access marks the connection for reconnection while successful calendar listing works', async () => {
  const revoked = calendarHarness(401, { error: { message: 'Unauthorized' } })
  await assert.rejects(revoked.calendars(), /401/)
  assert.equal(revoked.updates[0]![3], 'Authorization expired; reconnect')
  const healthy = calendarHarness(200, { items: [{ id: 'calendar', summary: 'Calendar', accessRole: 'owner' }] })
  const items = await healthy.calendars()
  assert.equal(items[0]!.id, 'calendar')
  assert.equal(healthy.updates.length, 0)
})
