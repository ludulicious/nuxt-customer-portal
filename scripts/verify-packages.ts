import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const workspaceRoot = resolve(import.meta.dirname, '..')
const packageDirectories = [
  'core',
  'ui',
  'authentication',
  'organizations',
  'clients',
  'administration',
  'service-requests',
  'timesheets',
  'invoices',
  'invoice-service-requests',
  'invoice-timesheets',
  'preset',
  'kit'
]
const layerPackages = new Set(packageDirectories.filter((name) => name !== 'kit'))
const migrationPackages = new Set(['core', 'service-requests', 'timesheets', 'invoices', 'invoice-service-requests', 'invoice-timesheets'])
const temporaryRoot = mkdtempSync(join(tmpdir(), 'nuxt-customer-portal-pack-'))
const tarballDirectory = join(temporaryRoot, 'tarballs')
mkdirSync(tarballDirectory)

const command = (executable: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) => {
  execFileSync(executable, args, { cwd, env, stdio: 'inherit' })
}

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const exportTargets = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value]
  }
  if (!value || typeof value !== 'object') {
    return []
  }
  return Object.values(value).flatMap(exportTargets)
}

const tarballs = new Map<string, string>()

try {
  for (const directory of packageDirectories) {
    const packageRoot = join(workspaceRoot, 'packages', directory)
    const before = new Set(readdirSync(tarballDirectory))
    execFileSync('pnpm', ['pack', '--pack-destination', tarballDirectory], { cwd: packageRoot, stdio: 'ignore' })
    const tarballName = readdirSync(tarballDirectory).find((file) => !before.has(file))
    if (!tarballName) {
      throw new Error(`pnpm pack did not create a tarball for ${directory}`)
    }

    const tarball = join(tarballDirectory, tarballName)
    const extractedRoot = join(temporaryRoot, 'extracted', directory)
    mkdirSync(extractedRoot, { recursive: true })
    command('tar', ['-xzf', tarball, '-C', extractedRoot], workspaceRoot)
    const contents = join(extractedRoot, 'package')
    const manifest = JSON.parse(readFileSync(join(contents, 'package.json'), 'utf8')) as {
      name: string
      version: string
      private?: boolean
      license?: string
      publishConfig?: { access?: string }
      exports?: Record<string, unknown>
      dependencies?: Record<string, string>
    }

    if (manifest.private) {
      throw new Error(`${manifest.name} is private in its tarball`)
    }
    if (manifest.version !== '0.1.0-alpha.0') {
      throw new Error(`${manifest.name} has an unlinked version`)
    }
    if (manifest.license !== 'MIT' || !existsSync(join(contents, 'LICENSE'))) {
      throw new Error(`${manifest.name} is missing MIT metadata`)
    }
    if (manifest.publishConfig?.access !== 'public') {
      throw new Error(`${manifest.name} is not configured for public access`)
    }
    if (!existsSync(join(contents, 'README.md'))) {
      throw new Error(`${manifest.name} is missing its README`)
    }

    for (const target of exportTargets(manifest.exports)) {
      if (target.includes('*')) {
        continue
      }
      if (!existsSync(resolve(contents, target))) {
        throw new Error(`${manifest.name} exports missing target ${target}`)
      }
    }
    for (const [dependency, version] of Object.entries(manifest.dependencies ?? {})) {
      if (dependency.startsWith('@nuxt-customer-portal/') && version.startsWith('workspace:')) {
        throw new Error(`${manifest.name} retains workspace protocol for ${dependency}`)
      }
    }

    if (layerPackages.has(directory)) {
      for (const required of ['nuxt.config.ts', 'portal.manifest.mjs']) {
        if (!existsSync(join(contents, required))) {
          throw new Error(`${manifest.name} is missing ${required}`)
        }
      }
    }
    if (migrationPackages.has(directory) && !existsSync(join(contents, 'migrations', '0000_baseline.sql'))) {
      throw new Error(`${manifest.name} is missing its baseline migration`)
    }
    if (directory === 'kit' && !existsSync(join(contents, 'bin', 'nuxt-customer-portal.mjs'))) {
      throw new Error(`${manifest.name} is missing its CLI`)
    }

    const forbidden = /(?:#portal|#types|#layers\/|\/Users\/|\.\.\/\.\.\/packages\/)/
    for (const file of walk(contents).filter((file) => /\.(?:ts|vue|mjs|js|json|md)$/.test(file))) {
      if (forbidden.test(readFileSync(file, 'utf8'))) {
        throw new Error(`${manifest.name} contains a forbidden contract in ${basename(file)}`)
      }
    }
    tarballs.set(manifest.name, tarball)
  }

  const requestedManager = process.argv.find((argument) => argument.startsWith('--manager='))?.split('=')[1]
  const requestedManagers = process.argv.includes('--consumers')
    ? requestedManager
      ? [requestedManager]
      : ['pnpm', 'npm', 'yarn', 'bun']
    : []
  for (const manager of requestedManagers) {
    try {
      execFileSync('sh', ['-c', `command -v ${manager}`], { stdio: 'ignore' })
    } catch {
      console.warn(`Skipping unavailable consumer package manager: ${manager}`)
      continue
    }
    const fixture = join(temporaryRoot, `consumer-${manager}`)
    mkdirSync(join(fixture, 'app'), { recursive: true })
    const dependencies = Object.fromEntries([...tarballs].map(([name, tarball]) => [name, `file:${tarball}`]))
    const fixtureManifest: Record<string, unknown> = {
      name: `portal-tarball-consumer-${manager}`,
      private: true,
      type: 'module',
      scripts: {
        prepare: 'nuxt prepare',
        typecheck: 'nuxt typecheck',
        build: 'nuxt build',
        doctor: 'nuxt-customer-portal doctor'
      },
      dependencies: { ...dependencies, nuxt: '4.5.1', vue: '3.5.40' },
      devDependencies: { '@types/node': '22.14.0', typescript: '6.0.3', 'vue-tsc': '3.3.9' }
    }
    if (manager === 'pnpm') {
      fixtureManifest.pnpm = {
        overrides: {
          ...dependencies,
          '@unhead/vue': '3.2.3',
          '@nuxt/devtools': '3.4.0',
          vue: '3.5.40',
          '@vue/compiler-sfc': '3.5.40',
          '@vue/compiler-ssr': '3.5.40',
          '@vue/runtime-core': '3.5.40',
          '@vue/runtime-dom': '3.5.40',
          '@vue/reactivity': '3.5.40',
          '@vue/shared': '3.5.40'
        }
      }
    }
    if (manager === 'npm') {
      fixtureManifest.overrides = {
        '@unhead/vue': '3.2.3',
        '@nuxt/devtools': '3.4.0',
        '@vue/compiler-sfc': '3.5.40',
        '@vue/compiler-ssr': '3.5.40',
        '@vue/runtime-core': '3.5.40',
        '@vue/runtime-dom': '3.5.40',
        '@vue/reactivity': '3.5.40',
        '@vue/shared': '3.5.40',
        '@typescript-eslint/typescript-estree': '8.65.0'
      }
    }
    if (manager === 'yarn') {
      fixtureManifest.resolutions = dependencies
    }
    if (manager === 'bun') {
      fixtureManifest.overrides = dependencies
    }
    writeFileSync(join(fixture, 'package.json'), JSON.stringify(fixtureManifest, null, 2))
    if (manager === 'pnpm') {
      writeFileSync(join(fixture, 'pnpm-workspace.yaml'), "packages:\n  - '.'\nminimumReleaseAge: 1440\n")
    }
    writeFileSync(
      join(fixture, 'portal.config.mjs'),
      `import { definePortalConfig } from '@nuxt-customer-portal/kit'\nexport default definePortalConfig({ layers: ['@nuxt-customer-portal/preset', '@nuxt-customer-portal/service-requests', '@nuxt-customer-portal/timesheets', '@nuxt-customer-portal/invoices', '@nuxt-customer-portal/invoice-timesheets'] })\n`
    )
    writeFileSync(
      join(fixture, 'nuxt.config.ts'),
      `import portal from './portal.config.mjs'\nexport default defineNuxtConfig({ extends: portal.nuxtLayers })\n`
    )
    writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({ extends: './.nuxt/tsconfig.json' }, null, 2))
    writeFileSync(join(fixture, 'app', 'app.vue'), '<template><NuxtPage /></template>\n')

    const installArgs: Record<string, string[]> = {
      pnpm: ['install'],
      npm: ['install'],
      yarn: ['install'],
      bun: ['install']
    }
    command(manager, installArgs[manager]!, fixture)
    const run = manager === 'npm' ? ['run'] : ['run']
    for (const script of ['prepare', 'typecheck', 'build', 'doctor']) {
      command(manager, [...run, script], fixture, {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/portal_fixture',
        PUBLIC_URL: 'http://localhost:3000',
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_SECRET: 'package-fixture-secret-at-least-32-characters'
      })
    }
  }

  console.log(
    `Verified ${tarballs.size} public package tarballs${process.argv.includes('--consumers') ? ' and available clean consumers' : ''}.`
  )
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
