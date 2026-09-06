import assert from 'node:assert/strict'
import { test } from 'node:test'

test('demo email boundaries reject before database configuration or provider access', async () => {
  const runtime = globalThis as typeof globalThis & { useRuntimeConfig?: () => unknown }
  const previous = runtime.useRuntimeConfig
  runtime.useRuntimeConfig = () => ({ portalDemo: { enabled: true } })
  try {
    const { sendPortalEmail, retrievePortalEmail, getPortalEmailProviderStatus } =
      await import('../server/utils/portal-email')
    for (const operation of [
      () => sendPortalEmail({} as Parameters<typeof sendPortalEmail>[0]),
      () => retrievePortalEmail('never-contact-the-provider'),
      () => getPortalEmailProviderStatus()
    ]) {
      await assert.rejects(operation, (error: unknown) => {
        const result = error as { statusCode: number; data: { code: string } }
        assert.equal(result.statusCode, 403)
        assert.equal(result.data.code, 'DEMO_RESTRICTED')
        return true
      })
    }
  } finally {
    runtime.useRuntimeConfig = previous
  }
})
