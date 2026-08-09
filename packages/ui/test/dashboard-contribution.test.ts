import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('dashboard contributions resolve registered components during setup', async () => {
  const source = await readFile(new URL('../app/components/DashboardContribution.vue', import.meta.url), 'utf8')

  assert.match(source, /const resolvedComponent = resolveComponent\(props\.component\)/)
  assert.doesNotMatch(source, /computed\(\(\) => resolveComponent/)
  assert.match(source, /v-if="!componentMissing"/)
})
