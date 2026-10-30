import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('account settings use the default portal background across all tabs', async () => {
  const source = await readFile(new URL('../../organizations/app/pages/settings.vue', import.meta.url), 'utf8')
  const shell = source.match(/<template>\s*<div class="([^"]+)"/)?.[1]

  assert.ok(shell)
  assert.ok(shell.split(/\s+/).includes('bg-default'))
  assert.ok(!shell.split(/\s+/).includes('bg-muted'))
  assert.match(source, /<NuxtPage\s*\/>/)
})
