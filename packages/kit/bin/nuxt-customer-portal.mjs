#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createJiti } from 'jiti'
import {
  adoptLegacyMigrations,
  assignPortalSystemAdmin,
  inspectPortalMigrations,
  migrateGenericClients,
  seedPortalProvider,
  migratePortalDatabase,
  resolvePortalManifests
} from '../src/runtime.mjs'

const cwd = process.cwd()
const args = process.argv.slice(2)
const configPath = ['portal.config.ts', 'portal.config.mjs', 'portal.config.js']
  .map(file => resolve(cwd, file))
  .find(existsSync)

if (!configPath) {
  console.error('No portal.config.ts, portal.config.mjs, or portal.config.js was found.')
  process.exit(1)
}

const jiti = createJiti(import.meta.url, { interopDefault: true })
const config = await jiti.import(configPath, { default: true })
const print = value => console.log(JSON.stringify(value, null, 2))

try {
  if (args[0] === 'doctor') {
    const manifests = await resolvePortalManifests(config, cwd)
    print({ ok: true, providers: manifests.map(({ id, version, source, dependsOn, migrations }) => ({ id, version, source, dependsOn, migrations: Boolean(migrations) })) })
  } else if (args[0] === 'db' && args[1] === 'status') {
    print(await inspectPortalMigrations(config, { cwd }))
  } else if (args[0] === 'db' && args[1] === 'migrate') {
    print({ applied: await migratePortalDatabase(config, { cwd }) })
  } else if (args[0] === 'db' && args[1] === 'adopt-legacy') {
    print(await adoptLegacyMigrations(config, { cwd, apply: args.includes('--apply') }))
  } else if (args[0] === 'clients' && args[1] === 'migrate') {
    const provider = args[args.indexOf('--provider') + 1]
    if (!provider || provider.startsWith('--')) throw new Error('clients migrate requires --provider <organization-id-or-slug>')
    print(await migrateGenericClients(config, {
      cwd,
      provider,
      apply: args.includes('--apply'),
      backupConfirmed: args.includes('--backup-confirmed'),
      once: args.includes('--once')
    }))
  } else if (args[0] === 'provider' && args[1] === 'seed') {
    const value = flag => args[args.indexOf(flag) + 1]
    print(await seedPortalProvider({
      organizationName: value('--organization-name'), organizationSlug: value('--organization-slug'),
      userName: value('--user-name'), userEmail: value('--user-email'), userPassword: value('--user-password')
    }))
  } else if (args[0] === 'admin' && args[1] === 'grant') {
    const email = args[args.indexOf('--email') + 1]
    if (!email || email.startsWith('--')) throw new Error('admin grant requires --email <existing-user-email>')
    print(await assignPortalSystemAdmin({ email }))
  } else if (args[0] === 'db' && args[1] === 'generate') {
    const provider = args[args.indexOf('--provider') + 1]
    if (!provider || provider.startsWith('--')) throw new Error('db generate requires --provider <id>')
    const manifest = (await resolvePortalManifests(config, cwd)).find(item => item.id === provider)
    if (!manifest) throw new Error(`Unknown provider: ${provider}`)
    if (!manifest.local) throw new Error('Only local providers can generate migrations; official package migrations are immutable')
    const drizzleConfig = resolve(manifest.root, 'drizzle.config.ts')
    if (!existsSync(drizzleConfig)) throw new Error(`Local provider must supply ${drizzleConfig}`)
    const result = spawnSync('pnpm', ['exec', 'drizzle-kit', 'generate', '--config', drizzleConfig], { cwd, stdio: 'inherit' })
    process.exit(result.status ?? 1)
  } else {
    console.log(`Usage:
  nuxt-customer-portal doctor
  nuxt-customer-portal db status
  nuxt-customer-portal db migrate
  nuxt-customer-portal db generate --provider <id>
  nuxt-customer-portal db adopt-legacy [--apply]
  nuxt-customer-portal admin grant --email <existing-user-email>
  nuxt-customer-portal provider seed --organization-name <name> --organization-slug <slug> --user-name <name> --user-email <email> --user-password <password>
  nuxt-customer-portal clients migrate --provider <id-or-slug> [--apply --backup-confirmed --once]`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
