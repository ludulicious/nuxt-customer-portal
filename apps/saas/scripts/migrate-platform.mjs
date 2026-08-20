import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'
import pg from 'pg'
import { migratePortalDatabase } from '@nuxt-customer-portal/kit'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = resolve(root, '.env')
if (existsSync(envFile)) loadEnvFile(envFile)

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

await migratePortalDatabase({
  layers: ['@nuxt-customer-portal/core', '@nuxt-customer-portal/ui', '@nuxt-customer-portal/clients'],
  nuxtLayers: ['@nuxt-customer-portal/core', '@nuxt-customer-portal/ui', '@nuxt-customer-portal/clients'],
  clients: { defaultModules: [] }
}, { cwd: root, databaseUrl })

const sql = await readFile(resolve(root, 'server/db/control-plane.sql'), 'utf8')
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
try {
  await pool.query(sql)
} finally {
  await pool.end()
}
