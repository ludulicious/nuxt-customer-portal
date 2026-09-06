import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import pg from 'pg'
import { prepareTemplate } from '../scripts/prepare-template.mjs'
import { createStarter, claimDatabase, initializeStarter, validateDatabaseUrl } from '../src/starter.mjs'
import { definePortalConfig, resolvePortalManifests } from '../src/runtime.mjs'
import { defaultPortalSettings } from '../../saas-configuration/shared/settings'

const root = fileURLToPath(new URL('../../', import.meta.url))
const input = {
  organizationName: 'Example Agency',
  userName: 'Portal Owner',
  userEmail: 'owner@example.com',
  packageManager: 'pnpm',
  database: 'docker',
  port: 3098,
  databasePort: 5498
}

test('starter generates a portable host with unique private secrets and no workspace imports', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'portal-starter-unit-'))
  try {
    const templateRoot = join(temp, 'template')
    await prepareTemplate(templateRoot)
    const first = await createStarter({ ...input, directory: join(temp, 'first') }, { templateRoot })
    await mkdir(join(temp, 'second'))
    const second = await createStarter({ ...input, directory: join(temp, 'second') }, { templateRoot })
    const manifest = JSON.parse(await readFile(join(first.directory, 'package.json'), 'utf8'))
    const env = await readFile(join(first.directory, '.env'), 'utf8')
    const secondEnv = await readFile(join(second.directory, '.env'), 'utf8')
    assert.equal(manifest.private, true)
    const configurationPackage = JSON.parse(await readFile(resolve(root, 'saas-configuration/package.json'), 'utf8'))
    assert.equal(manifest.dependencies['@nuxt-customer-portal/saas-configuration'], configurationPackage.version)
    assert.doesNotMatch(JSON.stringify(manifest), /workspace:/)
    assert.match(manifest.scripts.setup, /--env-file=\.env/)
    assert.match(manifest.scripts.dev, /--host localhost --port 3098/)
    assert.notEqual(env, secondEnv)
    assert.match(env, /PORTAL_EMAIL_ENCRYPTION_KEY=[a-f0-9]{64}/)
    assert.match(env, /PORTAL_REGISTRATION_MODE=invitation-only/)
    assert.match(env, /DATABASE_URL='postgresql:\/\/portal:[a-f0-9]+@localhost:5498\/portal'/)
    assert.equal((await stat(join(first.directory, '.env'))).mode & 0o777, 0o600)
    assert.doesNotMatch(await readFile(join(first.directory, 'app/app.vue'), 'utf8'), /demo-apex|\.\.\/\.\.\/packages/)
    assert.doesNotMatch(
      await readFile(join(first.directory, 'app/assets/css/main.css'), 'utf8'),
      /demo-apex|packages\/ui/
    )
    assert.doesNotMatch(await readFile(join(first.directory, 'eslint.config.mjs'), 'utf8'), /\.\.\//)
    assert.match(await readFile(join(first.directory, 'compose.yaml'), 'utf8'), /127\.0\.0\.1:5498:5432/)
    assert.match(await readFile(join(first.directory, 'pnpm-workspace.yaml'), 'utf8'), /onlyBuiltDependencies/)
    assert.match(await readFile(join(first.directory, '.gitignore'), 'utf8'), /^\.env\n/)
    assert.doesNotMatch(await readFile(join(first.directory, '.env.example'), 'utf8'), /[a-f0-9]{48}/)
    assert.equal(first.metadata.userEmail, input.userEmail)
    assert.equal('userPassword' in first.metadata, false)
    assert.equal(
      await readFile(join(second.directory, 'app/app.vue'), 'utf8'),
      await readFile(join(first.directory, 'app/app.vue'), 'utf8')
    )
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test('starter refuses existing files, symlink targets, and malformed connection strings', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'portal-starter-refusal-'))
  try {
    await writeFile(join(temp, 'keep.txt'), 'user work')
    await assert.rejects(createStarter({ ...input, directory: temp }), /Existing files will not be overwritten/)
    await symlink(temp, join(temp, 'linked'))
    await assert.rejects(
      createStarter({ ...input, directory: join(temp, 'linked') }),
      /Existing files will not be overwritten/
    )
    assert.equal(await readFile(join(temp, 'keep.txt'), 'utf8'), 'user work')
    for (const url of [
      'https://example.com/db',
      'postgresql://localhost',
      "postgresql://localhost/db'\nINJECTED=true"
    ]) {
      assert.ok(validateDatabaseUrl(url))
    }
    assert.equal(validateDatabaseUrl('postgresql://portal:encoded%27password@localhost:5432/portal'), undefined)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test('database claim refuses unrelated data and accepts only its own resumable marker', async () => {
  const queries: string[] = []
  const unrelated = {
    query: async (sql: string) => {
      queries.push(sql)
      return {
        rows: sql.includes('to_regclass')
          ? [{ name: null }]
          : sql.includes('pg_class')
            ? [{ relname: 'existing_data' }]
            : []
      }
    }
  }
  await assert.rejects(claimDatabase(unrelated, 'test'), /database is not empty/)
  assert.ok(queries.includes('ROLLBACK'))
  assert.ok(queries.every((sql) => !sql.startsWith('CREATE') && !sql.startsWith('INSERT')))
  const resume = {
    query: async (sql: string) => ({
      rows: sql.includes('to_regclass')
        ? [{ name: 'portal_starter_setup' }]
        : sql.startsWith('SELECT setup_id')
          ? [{ setup_id: 'ours', completed: true }]
          : []
    })
  }
  assert.equal(await claimDatabase(resume, 'ours'), true)
  await assert.rejects(claimDatabase(resume, 'other'), /belongs to another starter/)
})

test('init help works before a portal.config exists', () => {
  const output = execFileSync(process.execPath, [resolve(root, 'kit/bin/nuxt-customer-portal.mjs'), 'init', '--help'], {
    cwd: tmpdir(),
    encoding: 'utf8'
  })
  assert.match(output, /Create a standalone configurable portal/)
  assert.match(output, /--no-install/)
})

test('preset resolution works when only the preset and selected packages are direct dependencies', async () => {
  const providers = await resolvePortalManifests(
    definePortalConfig({
      layers: [
        '@nuxt-customer-portal/preset',
        '@nuxt-customer-portal/timesheets',
        '@nuxt-customer-portal/invoices',
        '@nuxt-customer-portal/invoice-timesheets',
        '@nuxt-customer-portal/saas-configuration'
      ]
    }),
    resolve(root, '../apps/saas-portal')
  )
  assert.ok(providers.some((item) => item.id === 'core'))
  assert.ok(providers.some((item) => item.id === 'saas-configuration'))
  assert.ok(!providers.some((item) => item.id === 'service-requests'))
})

const databaseUrl = process.env.PORTAL_STARTER_TEST_DATABASE_URL
test(
  'starter migrates a fresh database, seeds a verified admin, and resumes without resetting credentials',
  { skip: !databaseUrl },
  async () => {
    assert.match(new URL(databaseUrl!).pathname, /^\/portal_starter_test/)
    const config = definePortalConfig({
      layers: [
        '@nuxt-customer-portal/preset',
        '@nuxt-customer-portal/timesheets',
        '@nuxt-customer-portal/invoices',
        '@nuxt-customer-portal/invoice-timesheets',
        '@nuxt-customer-portal/saas-configuration'
      ]
    })
    const metadata = { ...input, id: '6297941a-f58b-4a4f-94c8-0f5692019150', organizationSlug: 'example-agency' }
    const options = {
      cwd: resolve(root, '../apps/saas-portal'),
      config,
      metadata,
      databaseUrl,
      getPassword: async () => 'A-test-only-password-123!',
      defaultSettings: defaultPortalSettings
    }
    assert.equal((await initializeStarter(options)).alreadyComplete, false)
    const pool = new pg.Pool({ connectionString: databaseUrl })
    try {
      const users = await pool.query('SELECT role, email_verified FROM "user" WHERE email=$1', [input.userEmail])
      assert.deepEqual(users.rows, [{ role: 'admin', email_verified: true }])
      const settings = await pool.query('SELECT settings, completed_at FROM saas_configuration.portal_settings')
      assert.equal(settings.rows[0].settings.branding.portalName, input.organizationName)
      assert.equal(settings.rows[0].completed_at, null)
      assert.ok(!settings.rows[0].settings.enabledModules.includes('service-requests'))
      const before = await pool.query('SELECT password FROM account WHERE provider_id=$1', ['credential'])
      assert.equal(
        (
          await initializeStarter({
            ...options,
            getPassword: async () => {
              throw new Error('must not ask again')
            }
          })
        ).alreadyComplete,
        true
      )
      const after = await pool.query('SELECT password FROM account WHERE provider_id=$1', ['credential'])
      assert.deepEqual(after.rows, before.rows)
      await assert.rejects(
        initializeStarter({ ...options, metadata: { ...metadata, id: 'e1d78c9c-3e1d-48da-8664-0b15c1d83c43' } }),
        /another starter/
      )
    } finally {
      await pool.end()
    }
  }
)
