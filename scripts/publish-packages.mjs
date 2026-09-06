import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// pnpm packs workspace dependencies into ordinary registry versions. npm performs
// the actual publication so its supported OIDC authentication is used in Actions.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
if (args.some((arg) => arg !== '--dry-run')) {
  throw new Error('Usage: pnpm release-packages [--dry-run]')
}
const dryRun = args.includes('--dry-run')
const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, 'packages', entry.name, 'package.json')))
  .map((entry) => {
    const directory = join(root, 'packages', entry.name)
    return { directory, manifest: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) }
  })
  .filter(({ manifest }) => !manifest.private)
const versions = new Set(packages.map(({ manifest }) => manifest.version))
if (versions.size !== 1) {
  throw new Error('All public packages must use the same release version.')
}
const version = [...versions][0]
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('This workflow publishes stable versions only.')
}
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG.replace(/^v/, '') !== version) {
  throw new Error(`Release tag does not match package version ${version}.`)
}

const ordered = []
const remaining = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]))
while (remaining.size) {
  const next = [...remaining.values()].find(({ manifest }) =>
    Object.keys(manifest.dependencies || {}).every((name) => !remaining.has(name))
  )
  if (!next) {
    throw new Error('Circular package dependencies prevent publication.')
  }
  ordered.push(next)
  remaining.delete(next.manifest.name)
}

// Check every package before publishing any, including packages that were
// successfully published by an interrupted earlier run.
const pending = []
for (const pkg of ordered) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.manifest.name)}/${version}`, {
    signal: AbortSignal.timeout(30_000)
  })
  if (response.status === 404) {
    pending.push(pkg)
  } else if (response.ok) {
    console.log(`Already published: ${pkg.manifest.name}@${version}`)
  } else {
    throw new Error(`Registry check failed for ${pkg.manifest.name}: HTTP ${response.status}`)
  }
}

const temporary = mkdtempSync(join(tmpdir(), 'portal-release-'))
try {
  const tarballs = []
  for (const pkg of pending) {
    const before = new Set(readdirSync(temporary))
    execFileSync('pnpm', ['pack', '--pack-destination', temporary], { cwd: pkg.directory, stdio: 'inherit' })
    const tarball = readdirSync(temporary).find((file) => !before.has(file) && file.endsWith('.tgz'))
    if (!tarball) {
      throw new Error(`Missing tarball for ${pkg.manifest.name}`)
    }
    tarballs.push(join(temporary, tarball))
  }
  for (const tarball of tarballs) {
    execFileSync(
      'npm',
      [
        'publish',
        tarball,
        '--access',
        'public',
        '--tag',
        'latest',
        '--registry',
        'https://registry.npmjs.org',
        ...(dryRun ? ['--dry-run'] : [])
      ],
      {
        cwd: temporary,
        stdio: 'inherit'
      }
    )
  }
  console.log(`${dryRun ? 'Dry run verified' : 'Published'} ${tarballs.length} packages at ${version}.`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
