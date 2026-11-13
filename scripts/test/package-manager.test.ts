import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../require-pnpm.mjs', import.meta.url))
test('installation accepts pnpm and rejects unsupported package managers with actionable guidance', () => {
  for (const userAgent of ['npm/11.0.0', 'yarn/4.0.0', 'bun/1.0.0', '']) {
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, npm_config_user_agent: userAgent },
      encoding: 'utf8'
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /supports pnpm only/)
    assert.match(result.stderr, /Fork the project/)
  }
  const supported = spawnSync(process.execPath, [script], {
    env: { ...process.env, npm_config_user_agent: 'pnpm/10.30.2 npm/? node/v22.22.0' }
  })
  assert.equal(supported.status, 0)
})
