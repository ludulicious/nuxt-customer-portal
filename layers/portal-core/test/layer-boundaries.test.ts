import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { upsertPortalFeature } from '../shared/feature-registry'
import type { PortalFeatureDefinition } from '../shared/types/feature'

const root = new URL('../../..', import.meta.url).pathname

const walk = async (directory: string): Promise<string[]> => (await Promise.all(
  (await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory()
    ? walk(join(directory, entry.name))
    : [join(directory, entry.name)]))).flat()

test('feature registration replaces duplicates and keeps module contributions', () => {
  const original: PortalFeatureDefinition = {
    id: 'example',
    modules: [{ id: 'one', labelKey: 'one', to: '/one', routePrefixes: ['/one'], audiences: ['authenticated'] }],
    policy: { owner: [], admin: [], member: [] }
  }
  const replacement = { ...original, modules: [{ ...original.modules![0]!, to: '/updated' }] }
  const result = upsertPortalFeature(upsertPortalFeature([], original), replacement)
  assert.equal(result.length, 1)
  assert.equal(result[0]?.modules?.[0]?.to, '/updated')
})

test('every translated layer has matching English and Dutch key trees', async () => {
  const layers = ['portal-core', 'public-site', 'authentication', 'account-organizations', 'administration', 'service-requests', 'timesheets']
  const keys = (value: unknown, prefix = ''): string[] => value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]
  for (const layer of layers) {
    const localeRoot = join(root, 'layers', layer, 'i18n', 'locales')
    const en = JSON.parse(await readFile(join(localeRoot, 'en.json'), 'utf8'))
    const nl = JSON.parse(await readFile(join(localeRoot, 'nl.json'), 'utf8'))
    assert.deepEqual(keys(en).sort(), keys(nl).sort(), `${layer} locale keys differ`)
  }
})

test('feature layers do not import host aliases', async () => {
  const files = (await walk(join(root, 'layers'))).filter(file => /\.(?:ts|vue)$/.test(file))
  const violations: string[] = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/from ['"]~{1,2}\/(?!layers\/portal-core\/server\/db\/schema)/.test(source)) violations.push(file)
  }
  assert.deepEqual(violations, [])
})
