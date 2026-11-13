import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'
import { Pool } from 'pg'
import { inspectPortalMigrations, migratePortalDatabase } from '../portal/runtime.mjs'

const databaseUrl = process.env.PORTAL_TEST_DATABASE_URL
assert.ok(databaseUrl && new URL(databaseUrl).pathname.endsWith('_test'), 'Use a disposable _test database')
const jiti = createJiti(import.meta.url, { interopDefault: true })
const config = await jiti.import(resolve('apps/saas-portal/portal.config.ts'), { default: true })
const options = { cwd: resolve('apps/saas-portal'), databaseUrl }
const pool = new Pool({ connectionString: databaseUrl })
try {
  await migratePortalDatabase(config, options)
  assert.deepEqual(await migratePortalDatabase(config, options), [])
  const initial = await inspectPortalMigrations(config, options)
  assert.ok(initial.length >= 9)
  assert.ok(initial.every((provider) => provider.applied > 0 && provider.pending.length === 0))
  // The old package-version column remains readable after independent package releases are retired.
  await pool.query("UPDATE nuxt_customer_portal_migrations.provider_core SET package_version='0.1.0-historical'")
  assert.deepEqual(await migratePortalDatabase(config, options), [])
  const original = await pool.query(
    'SELECT name, checksum FROM nuxt_customer_portal_migrations.provider_core ORDER BY name LIMIT 1'
  )
  const row = original.rows[0]
  await pool.query('UPDATE nuxt_customer_portal_migrations.provider_core SET checksum=$1 WHERE name=$2', [
    'invalid',
    row.name
  ])
  try {
    await assert.rejects(migratePortalDatabase(config, options), /Checksum mismatch/)
  } finally {
    await pool.query('UPDATE nuxt_customer_portal_migrations.provider_core SET checksum=$1 WHERE name=$2', [
      row.checksum,
      row.name
    ])
  }
  assert.deepEqual(await inspectPortalMigrations(config, options), initial)
  console.log(
    'Migration integration passed: full schema, repeat application, historical journal versions and checksum-drift protection'
  )
} finally {
  await pool.end()
}
