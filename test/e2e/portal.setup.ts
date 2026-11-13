import { Pool } from 'pg'
import { createJiti } from 'jiti'
import { resolve } from 'node:path'
import { assignPortalSystemAdmin, migratePortalDatabase, seedPortalProvider } from '../../scripts/portal/runtime.mjs'

export default async function setup() {
  const connection = new URL(process.env.E2E_DATABASE_URL!)
  if (!/^\/[a-z0-9_]+_e2e$/.test(connection.pathname)) {
    throw new Error('Browser tests require a disposable database with a simple name ending in _e2e')
  }
  const adminUrl = new URL(connection)
  adminUrl.pathname = '/postgres'
  const pool = new Pool({ connectionString: adminUrl.href })
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const config = await jiti.import(resolve('apps/saas-portal/portal.config.ts'), { default: true })
  try {
    for (const suffix of ['', '_demo']) {
      const name = connection.pathname.slice(1) + suffix
      const exists = await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])
      if (!exists.rowCount) {
        await pool.query(`CREATE DATABASE "${name}"`)
      }
      const url = new URL(connection)
      url.pathname = '/' + name
      await migratePortalDatabase(config, { cwd: resolve('apps/saas-portal'), databaseUrl: url.href })
    }
    await seedPortalProvider({
      databaseUrl: connection.href,
      organizationName: 'Test Portal',
      organizationSlug: 'portal-e2e',
      userName: 'Portal Owner',
      userEmail: 'owner@example.test',
      userPassword: 'Portal-e2e-password-2026!'
    })
    await assignPortalSystemAdmin({ databaseUrl: connection.href, email: 'owner@example.test' })
  } finally {
    await pool.end()
  }
}

await setup()
