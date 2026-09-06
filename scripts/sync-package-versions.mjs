import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../packages/', import.meta.url))
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'kit') {
    continue
  }
  const directory = resolve(root, entry.name)
  if (!existsSync(resolve(directory, 'package.json'))) {
    continue
  }
  const { version } = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
  const path = resolve(directory, 'portal.manifest.mjs')
  const source = readFileSync(path, 'utf8')
  if (!/^ {2}version: '[^']+',$/m.test(source)) {
    throw new Error(`Cannot update version in ${path}`)
  }
  writeFileSync(path, source.replace(/^ {2}version: '[^']+',$/m, `  version: '${version}',`))
}
