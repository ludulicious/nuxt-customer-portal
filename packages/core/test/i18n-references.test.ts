import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const repository = new URL('../../../', import.meta.url)
const sourceFiles = (directory: URL): URL[] => existsSync(directory)
  ? readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? sourceFiles(new URL(`${entry.name}/`, directory))
      : /\.(?:ts|vue)$/.test(entry.name) ? [new URL(entry.name, directory)] : [])
  : []
const localeKeys = (value: unknown, prefix = ''): string[] => !value || typeof value !== 'object' || Array.isArray(value)
  ? [prefix]
  : Object.entries(value).flatMap(([key, child]) => localeKeys(child, prefix ? `${prefix}.${key}` : key))

const packageNames = readdirSync(new URL('packages/', repository), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
const appNames = readdirSync(new URL('apps/', repository), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)

test('all application translation references exist in English and Dutch', () => {
  const keys = { en: new Set<string>(), nl: new Set<string>() }
  for (const locale of ['en', 'nl'] as const) {
    for (const base of [...packageNames.map(name => `packages/${name}`), ...appNames.map(name => `apps/${name}`)]) {
      const file = new URL(`${base}/i18n/locales/${locale}.json`, repository)
      if (!existsSync(file)) continue
      for (const key of localeKeys(JSON.parse(readFileSync(file, 'utf8')))) keys[locale].add(key)
    }
  }

  const files = [
    ...packageNames.flatMap(name => [...sourceFiles(new URL(`packages/${name}/app/`, repository)), ...sourceFiles(new URL(`packages/${name}/shared/`, repository))]),
    ...appNames.flatMap(name => sourceFiles(new URL(`apps/${name}/app/`, repository)))
  ]
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const literalReferences = [
      ...source.matchAll(/(?<![\w$])(?:\$t|t)\(\s*['"]([^'"`]+)['"]/g),
      ...source.matchAll(/(?:labelKey|descriptionKey|titleKey)\s*:\s*['"]([^'"]+)['"]/g)
    ].map(match => match[1])
    for (const locale of ['en', 'nl'] as const) {
      for (const key of literalReferences) assert.ok(keys[locale].has(key), `${file.pathname} references missing ${locale} locale key ${key}`)
    }

    for (const match of source.matchAll(/(?<![\w$])(?:\$t|t)\(\s*`([^`]*?)\$\{/g)) {
      const prefix = match[1]
      for (const locale of ['en', 'nl'] as const) assert.ok([...keys[locale]].some(key => key.startsWith(prefix)), `${file.pathname} references empty ${locale} dynamic locale family ${prefix}`)
    }
  }
})
