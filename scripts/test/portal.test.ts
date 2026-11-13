import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { definePortalConfig, localPortalLayer, sortPortalManifests } from '../portal/runtime.mjs'

test('portal config exposes Nuxt layer sources without losing provider metadata', () => {
  const local = localPortalLayer({
    id: 'billing',
    source: './layers/billing',
    schema: './layers/billing/server/db/schema',
    migrations: './layers/billing/migrations',
    migrationSearchPath: ['billing', 'public'],
    dependsOn: ['core']
  })
  const config = definePortalConfig({ layers: ['@nuxt-customer-portal/core', local] })
  assert.deepEqual(config.nuxtLayers, ['@nuxt-customer-portal/core', './layers/billing'])
  assert.equal(config.layers[1], local)
  assert.deepEqual(local.migrationSearchPath, ['billing', 'public'])
})

test('timesheets migrations run with their schema on the transaction-local search path', async () => {
  const manifest = (await import('../../packages/timesheets/portal.manifest.mjs')).default
  const runtime = await readFile(new URL('../portal/runtime.mjs', import.meta.url), 'utf8')

  assert.deepEqual(manifest.migrationSearchPath, ['timesheets', 'public'])
  assert.match(runtime, /SET LOCAL search_path TO/)
})

test('provider manifests sort dependencies before consumers', () => {
  const ordered = sortPortalManifests([
    { id: 'feature', version: '1.0.0', source: 'feature', dependsOn: ['ui', 'core'] },
    { id: 'ui', version: '1.0.0', source: 'ui', dependsOn: ['core'] },
    { id: 'core', version: '1.0.0', source: 'core', dependsOn: [] }
  ])
  assert.deepEqual(
    ordered.map((provider) => provider.id),
    ['core', 'ui', 'feature']
  )
})

test('provider validation rejects duplicate IDs, missing dependencies, and cycles', () => {
  const provider = { id: 'core', version: '1.0.0', source: 'core', dependsOn: [] }
  assert.throws(() => sortPortalManifests([provider, provider]), /Duplicate provider id/)
  assert.throws(() => sortPortalManifests([{ ...provider, id: 'feature', dependsOn: ['missing'] }]), /missing provider/)
  assert.throws(
    () =>
      sortPortalManifests([
        { ...provider, id: 'one', dependsOn: ['two'] },
        { ...provider, id: 'two', dependsOn: ['one'] }
      ]),
    /dependency cycle/
  )
  assert.throws(
    () =>
      sortPortalManifests([
        { ...provider, id: 'acme-billing' },
        { ...provider, id: 'acme_billing' }
      ]),
    /same migration journal/
  )
})

test('provider terminology is used by client migration and provider seeding', async () => {
  const [runtime, cli] = await Promise.all([
    readFile(new URL('../portal/runtime.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../portal.mjs', import.meta.url), 'utf8')
  ])

  assert.match(runtime, /options\.provider, '--provider'/)
  assert.match(runtime, /to_regclass\('timesheets\.organization_contact'\)/)
  assert.match(runtime, /ranked_contacts/)
  assert.match(runtime, /to_regclass\('service_requests\.service_request'\)/)
  assert.match(runtime, /already applied for provider/)
  assert.match(runtime, /options\.once/)
  assert.match(runtime, /seedPortalProvider/)
  assert.match(runtime, /bootstrapPortalProvider/)
  assert.match(runtime, /to_regclass\('timesheets\.workspace_settings'\)/)
  assert.match(runtime, /to_regclass\('invoices\.settings'\)/)
  assert.match(cli, /provider seed/)
  assert.match(cli, /provider bootstrap/)
  assert.match(cli, /clients migrate --provider/)
  assert.match(cli, /--once/)
  assert.doesNotMatch(cli, /owner seed|clients migrate --owner/)
})
