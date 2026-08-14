import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import rootEn from '../../../apps/demo-apex/i18n/locales/en.json' with { type: 'json' }
import rootNl from '../../../apps/demo-apex/i18n/locales/nl.json' with { type: 'json' }
import layerEn from '../i18n/locales/en.json' with { type: 'json' }
import layerNl from '../i18n/locales/nl.json' with { type: 'json' }
import coreEn from '../../core/i18n/locales/en.json' with { type: 'json' }
import coreNl from '../../core/i18n/locales/nl.json' with { type: 'json' }
import { serviceRequestFeature } from '../shared/feature'
import { filterServiceRequestSchema } from '../server/utils/service-request-validation'

const objectKeys = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    objectKeys(child, prefix ? `${prefix}.${key}` : key))
}

test('English and Dutch expose identical feature locale keys', () => {
  assert.deepEqual(objectKeys(layerEn).sort(), objectKeys(layerNl).sort())
})

test('all app translation references exist in both locales', () => {
  const localeKeys = {
    en: new Set([...objectKeys(rootEn), ...objectKeys(coreEn), ...objectKeys(layerEn)]),
    nl: new Set([...objectKeys(rootNl), ...objectKeys(coreNl), ...objectKeys(layerNl)])
  }
  const files = [
    ...sourceFiles(new URL('../../../apps/demo-apex/app/', import.meta.url)),
    ...sourceFiles(new URL('../app/', import.meta.url))
  ]

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const referencedKeys = [
      ...source.matchAll(/(?<![\w$])(?:\$t|t)\(\s*['"]([^'"`]+)['"]/g),
      ...source.matchAll(/labelKey\s*:\s*['"]([^'"]+)['"]/g)
    ].map(match => match[1])

    for (const [locale, keys] of Object.entries(localeKeys)) {
      for (const key of referencedKeys) {
        assert.equal(keys.has(key), true, `${file.pathname} references missing ${locale} locale key ${key}`)
      }
    }
  }
})

test('query validation normalizes both new and legacy pagination', () => {
  assert.deepEqual(
    filterServiceRequestSchema.parse({ page: '2', pageSize: '10' }),
    expectPagination(2, 10, 10)
  )
  assert.deepEqual(
    filterServiceRequestSchema.parse({ skip: '20', take: '10' }),
    expectPagination(3, 10, 20, { skip: 20, take: 10 })
  )
})

test('service-request policy keeps management out of the member role', () => {
  assert.equal(serviceRequestFeature.policy.PROVIDER.owner.includes('manage'), true)
  assert.equal(serviceRequestFeature.policy.PROVIDER.admin.includes('manage'), true)
  assert.equal(serviceRequestFeature.policy.CLIENT.member.includes('manage'), false)
})

test('service-request dashboard separates manager attention from the general overview', () => {
  assert.deepEqual(serviceRequestFeature.dashboardWidgets?.map(widget => widget.id), [
    'service-requests-attention',
    'service-requests-overview'
  ])
  assert.equal(serviceRequestFeature.dashboardWidgets?.find(widget => widget.id === 'service-requests-attention')?.area, 'attention')
})

function expectPagination(
  page: number,
  pageSize: number,
  offset: number,
  extra: Record<string, number> = {}
) {
  return {
    sortBy: 'createdAt',
    sortDir: 'desc',
    page,
    pageSize,
    offset,
    ...extra
  }
}

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name, directory)
    if (entry.isDirectory()) return sourceFiles(new URL(`${entry.name}/`, directory))
    return /\.(?:ts|vue)$/.test(entry.name) ? [url] : []
  })
}
