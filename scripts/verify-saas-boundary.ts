import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const runtimeRoots = ['packages', 'apps/demo-apex', 'apps/demo-brutal', 'apps/saas-portal']
const sourceExtensions = new Set(['.js', '.mjs', '.ts', '.vue'])
const forbidden = [
  { label: 'SaaS application import', pattern: /(?:from\s+|import\s*\()['"](?:~\/|@\/|\.\.\/)*apps\/saas(?:\/|['"])/ },
  { label: 'SaaS runtime environment variable', pattern: /process\.env\.SAAS_[A-Z0-9_]+/ },
  {
    label: 'request-scoped portal runtime',
    pattern:
      /(?:PortalRequestContext|runWithPortalRequestContext|enterPortalRequestContext|createRequestAwareAuth|createRequestAwareDatabase)/
  },
  { label: 'platform auth injection', pattern: /event\.context\.portalAuth/ }
]

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (['node_modules', '.nuxt', '.output', 'dist'].includes(entry.name)) {
      continue
    }
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)))
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(path)
    }
  }
  return files
}

const violations: string[] = []
for (const runtimeRoot of runtimeRoots) {
  for (const file of await sourceFiles(join(root, runtimeRoot))) {
    const source = await readFile(file, 'utf8')
    for (const rule of forbidden) {
      if (rule.pattern.test(source)) {
        violations.push(`${relative(root, file)}: ${rule.label}`)
      }
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `SaaS/control-plane code crossed the portal runtime boundary:\n${violations.join('\n')}`
)
console.log('Customer Portal runtime is independent from the SaaS control plane.')
