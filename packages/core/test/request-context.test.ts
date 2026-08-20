import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequestAwareAuth } from '../server/utils/runtime-auth'
import { getPortalRequestContext, runWithPortalRequestContext } from '../server/utils/request-context'

test('request-aware providers remain isolated across concurrent requests', async () => {
  const fixed = { name: 'fixed', identify() { return this.name } }
  const auth = createRequestAwareAuth(fixed)
  const database = {} as never

  const identify = (name: string, delay: number) => runWithPortalRequestContext({
    database,
    mode: 'tenant',
    auth: { name, identify: fixed.identify }
  }, async () => {
    await new Promise(resolve => setTimeout(resolve, delay))
    assert.equal(getPortalRequestContext()?.mode, 'tenant')
    return auth.identify()
  })

  assert.deepEqual(await Promise.all([identify('alpha', 10), identify('beta', 1)]), ['alpha', 'beta'])
  assert.equal(auth.identify(), 'fixed')
})
