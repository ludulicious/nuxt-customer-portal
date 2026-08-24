import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import test from 'node:test'
import { upsertPortalFeature } from '../shared/feature-registry'
import type { PortalFeatureDefinition } from '../shared/types/feature'

const root = new URL('../../..', import.meta.url).pathname

const walk = async (directory: string): Promise<string[]> =>
  (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) =>
        entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]
      )
    )
  ).flat()

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
  const layers = [
    'packages/core',
    'packages/authentication',
    'packages/organizations',
    'packages/administration',
    'packages/service-requests',
    'packages/timesheets',
    'apps/demo-apex/layers/public-site'
  ]
  const keys = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
      : [prefix]
  for (const layer of layers) {
    const localeRoot = join(root, layer, 'i18n', 'locales')
    const en = JSON.parse(await readFile(join(localeRoot, 'en.json'), 'utf8'))
    const nl = JSON.parse(await readFile(join(localeRoot, 'nl.json'), 'utf8'))
    assert.deepEqual(keys(en).sort(), keys(nl).sort(), `${layer} locale keys differ`)
  }
})

test('packages use public package exports rather than host or filesystem contracts', async () => {
  const files = (await walk(join(root, 'packages'))).filter(
    (file) => /\.(?:ts|vue)$/.test(file) && !file.includes('/node_modules/') && !file.includes('/test/')
  )
  const violations: string[] = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/(?:from|import\()\s*['"](?:#portal|#types|#layers\/|~\/|~~\/)/.test(source)) {
      violations.push(relative(root, file))
    }
    for (const match of source.matchAll(/(?:from|import\()\s*['"](\.\.?\/[^'"]+)/g)) {
      const target = join(dirname(file), match[1]!)
      if (relative(join(root, 'packages'), target).startsWith('..')) {
        violations.push(relative(root, file))
      }
      const sourcePackage = relative(join(root, 'packages'), file).split('/')[0]
      const targetPackage = relative(join(root, 'packages'), target).split('/')[0]
      if (sourcePackage !== targetPackage && !targetPackage.startsWith('..')) {
        violations.push(relative(root, file))
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('platform packages do not import optional business features', async () => {
  const platformPackages = ['core', 'ui', 'authentication', 'organizations', 'administration', 'preset']
  const violations: string[] = []
  for (const packageName of platformPackages) {
    const files = (await walk(join(root, 'packages', packageName))).filter((file) => /\.(?:ts|vue)$/.test(file))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      if (/@nuxt-customer-portal\/(?:service-requests|timesheets)/.test(source)) {
        violations.push(relative(root, file))
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('reusable package runtime and content contain no demo branding', async () => {
  const files = (await walk(join(root, 'packages'))).filter(
    (file) => !file.includes('/test/') && !file.includes('/node_modules/') && !file.endsWith('/package.json')
  )
  const violations: string[] = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/Apex\s?Pro|Ludulicious|Facility Services/i.test(source)) {
      violations.push(relative(root, file))
    }
  }
  assert.deepEqual(violations, [])
})
