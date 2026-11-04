import assert from 'node:assert/strict'
import test from 'node:test'
import { createError, type H3Event } from 'h3'
import { PortalEncryptionConfigurationError } from '../server/utils/portal-encryption'
import { logPortalServerError } from '../server/utils/server-error-logging'

const event = {
  method: 'PUT',
  path: '/api/admin/email/provider?token=private-query',
  context: { session: { token: 'private-session' } },
  headers: { authorization: 'Bearer private-auth' }
} as unknown as H3Event

test('the Nitro plugin logs handled server failures through the error hook', async (context) => {
  const previousPlugin = Reflect.get(globalThis, 'defineNitroPlugin')
  Reflect.set(globalThis, 'defineNitroPlugin', (plugin: unknown) => plugin)
  const messages: string[] = []
  context.mock.method(console, 'error', (message: string) => messages.push(message))
  try {
    const plugin = (await import('../server/plugins/error-logging')).default
    const handlers: Array<(error: Error, context: { event?: H3Event }) => void> = []
    plugin({
      hooks: {
        hook: (name: string, handler: (error: Error, context: { event?: H3Event }) => void) => {
          assert.equal(name, 'error')
          handlers.push(handler)
        }
      }
    } as unknown as Parameters<typeof plugin>[0])
    assert.equal(handlers.length, 1)
    handlers[0]!(createError({ statusCode: 503 }), { event })
    assert.equal(JSON.parse(messages[0]!).statusCode, 503)
  } finally {
    if (previousPlugin === undefined) {
      Reflect.deleteProperty(globalThis, 'defineNitroPlugin')
    } else {
      Reflect.set(globalThis, 'defineNitroPlugin', previousPlugin)
    }
  }
})

test('handled server errors log safe encryption diagnostics without request secrets', () => {
  const messages: string[] = []
  const error = createError({
    statusCode: 503,
    message: 'Do not log re_private-key',
    data: { apiKey: 're_private-key' },
    cause: new PortalEncryptionConfigurationError('Configure PORTAL_ENCRYPTION_KEY or PORTAL_EMAIL_ENCRYPTION_KEY')
  })
  logPortalServerError(error, event, (message) => messages.push(message))
  assert.equal(messages.length, 1)
  assert.deepEqual(JSON.parse(messages[0]!), {
    event: 'portal.server_error',
    method: 'PUT',
    path: '/api/admin/email/provider',
    statusCode: 503,
    code: 'PORTAL_ENCRYPTION_CONFIGURATION',
    message: 'Configure PORTAL_ENCRYPTION_KEY or PORTAL_EMAIL_ENCRYPTION_KEY'
  })
  assert.doesNotMatch(messages.join(''), /re_private-key|private-query|private-session|private-auth/)
})

test('database causes expose only allowlisted codes and migration guidance, not queries or parameters', () => {
  const messages: string[] = []
  logPortalServerError(
    new Error('Failed query with re_private-key', {
      cause: Object.assign(new Error('private database detail'), { code: '42703', parameters: ['re_private-key'] })
    }),
    event,
    (message) => messages.push(message)
  )
  const result = JSON.parse(messages[0]!)
  assert.equal(result.statusCode, 500)
  assert.equal(result.code, '42703')
  assert.match(result.message, /migrations/)
  assert.doesNotMatch(messages[0]!, /re_private-key|private database detail|Failed query/)
})

test('unexpected errors and startup failures are logged without arbitrary exception details', () => {
  const messages: string[] = []
  logPortalServerError(new Error('re_private-key'), undefined, (message) => messages.push(message))
  const result = JSON.parse(messages[0]!)
  assert.equal(result.code, 'SERVER_ERROR')
  assert.equal(result.path, null)
  assert.doesNotMatch(messages[0]!, /re_private-key/)
})

test('expected validation and authorization failures do not produce server error logs', () => {
  const messages: string[] = []
  for (const statusCode of [401, 403, 404, 422]) {
    logPortalServerError(createError({ statusCode }), event, (message) => messages.push(message))
  }
  assert.deepEqual(messages, [])
})
