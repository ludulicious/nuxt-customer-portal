import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { assertCompatiblePortalVersions, definePortalConfig, localPortalLayer, sortPortalManifests } from '../src/runtime.mjs'

test('portal config exposes Nuxt layer sources without losing provider metadata', () => {
  const local = localPortalLayer({
    id: 'billing',
    source: './layers/billing',
    schema: './layers/billing/server/db/schema',
    migrations: './layers/billing/migrations',
    migrationSearchPath: ['billing', 'public'],
    dependsOn: ['core']
  })
  const config = definePortalConfig({ layers: ['@nuxt-customer-portal/preset', local] })
  assert.deepEqual(config.nuxtLayers, ['@nuxt-customer-portal/preset', './layers/billing'])
  assert.equal(config.layers[1], local)
  assert.deepEqual(local.migrationSearchPath, ['billing', 'public'])
})

test('timesheets migrations run with their schema on the transaction-local search path', async () => {
  const manifest = (await import('../../timesheets/portal.manifest.mjs')).default
  const runtime = await readFile(new URL('../src/runtime.mjs', import.meta.url), 'utf8')

  assert.deepEqual(manifest.migrationSearchPath, ['timesheets', 'public'])
  assert.match(runtime, /SET LOCAL search_path TO/)
})

test('provider manifests sort dependencies before consumers', () => {
  const ordered = sortPortalManifests([
    { id: 'feature', version: '1.0.0', source: 'feature', dependsOn: ['ui', 'core'] },
    { id: 'ui', version: '1.0.0', source: 'ui', dependsOn: ['core'] },
    { id: 'core', version: '1.0.0', source: 'core', dependsOn: [] }
  ])
  assert.deepEqual(ordered.map(provider => provider.id), ['core', 'ui', 'feature'])
})

test('provider validation rejects duplicate IDs, missing dependencies, and cycles', () => {
  const provider = { id: 'core', version: '1.0.0', source: 'core', dependsOn: [] }
  assert.throws(() => sortPortalManifests([provider, provider]), /Duplicate provider id/)
  assert.throws(() => sortPortalManifests([{ ...provider, id: 'feature', dependsOn: ['missing'] }]), /missing provider/)
  assert.throws(() => sortPortalManifests([
    { ...provider, id: 'one', dependsOn: ['two'] },
    { ...provider, id: 'two', dependsOn: ['one'] }
  ]), /dependency cycle/)
  assert.throws(() => sortPortalManifests([
    { ...provider, id: 'acme-billing' },
    { ...provider, id: 'acme_billing' }
  ]), /same migration journal/)
})

test('manifest resolution rejects mixed official package versions', () => {
  assert.throws(() => assertCompatiblePortalVersions([
    { id: 'core', version: '0.1.0-alpha.0', source: '@nuxt-customer-portal/core', dependsOn: [] },
    { id: 'ui', version: '0.2.0-alpha.0', source: '@nuxt-customer-portal/ui', dependsOn: ['core'] }
  ]), /Incompatible official package versions/)
  assert.doesNotThrow(() => assertCompatiblePortalVersions([
    { id: 'core', version: '0.1.0-alpha.0', source: '@nuxt-customer-portal/core', dependsOn: [] },
    { id: 'local', version: '9.0.0', source: './layers/local', dependsOn: ['core'] }
  ]))
})

test('provider terminology is used by client migration and provider seeding', async () => {
  const [runtime, cli] = await Promise.all([
    readFile(new URL('../src/runtime.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../bin/nuxt-customer-portal.mjs', import.meta.url), 'utf8')
  ])

  assert.match(runtime, /options\.provider, '--provider'/)
  assert.match(runtime, /to_regclass\('timesheets\.organization_contact'\)/)
  assert.match(runtime, /ranked_contacts/)
  assert.match(runtime, /to_regclass\('service_requests\.service_request'\)/)
  assert.match(runtime, /already applied for provider/)
  assert.match(runtime, /options\.once/)
  assert.match(runtime, /seedPortalProvider/)
  assert.match(cli, /provider seed/)
  assert.match(cli, /clients migrate --provider/)
  assert.match(cli, /--once/)
  assert.doesNotMatch(cli, /owner seed|clients migrate --owner/)
})
