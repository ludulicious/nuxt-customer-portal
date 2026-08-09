import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const migrationSchema = 'nuxt_customer_portal_migrations'
const lockName = 'nuxt-customer-portal:migrations'
const providerTable = id => `provider_${id.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`

const assertString = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`)
  return value
}

export const localPortalLayer = (input) => ({
  kind: 'local',
  id: assertString(input.id, 'Local layer id'),
  source: assertString(input.source, 'Local layer source'),
  version: input.version ?? '0.0.0-local',
  schema: input.schema,
  migrations: input.migrations,
  dependsOn: [...(input.dependsOn ?? [])]
})

export const definePortalConfig = ({ layers }) => {
  if (!Array.isArray(layers) || !layers.length) throw new Error('Portal config must contain at least one layer')
  return {
    layers,
    nuxtLayers: layers.map(layer => typeof layer === 'string' ? layer : layer.source)
  }
}

const packageManifest = async (source, cwd) => {
  const consumerRequire = createRequire(resolve(cwd, 'package.json'))
  let manifestPath
  try {
    manifestPath = consumerRequire.resolve(`${source}/portal-manifest`)
  } catch (error) {
    throw new Error(`Cannot resolve ${source}/portal-manifest from ${cwd}: ${error.message}`)
  }
  const imported = await import(pathToFileURL(manifestPath).href)
  return { ...imported.default, root: dirname(manifestPath), local: false }
}

const localManifest = (layer, cwd) => {
  const root = resolve(cwd, layer.source)
  return { ...layer, root, local: true }
}

export const assertCompatiblePortalVersions = (manifests) => {
  const officialVersions = new Set(manifests
    .filter(manifest => manifest.source.startsWith('@nuxt-customer-portal/'))
    .map(manifest => manifest.version))
  if (officialVersions.size > 1) {
    throw new Error(`Incompatible official package versions: ${[...officialVersions].sort().join(', ')}`)
  }
}

export const resolvePortalManifests = async (config, cwd = process.cwd()) => {
  const pending = [...config.layers]
  const manifests = []
  const expandedSources = new Set()

  while (pending.length) {
    const layer = pending.shift()
    const manifest = typeof layer === 'string'
      ? await packageManifest(layer, cwd)
      : localManifest(layer, cwd)
    const existing = manifests.find(item => item.id === manifest.id)
    if (existing) {
      if (existing.source !== manifest.source || existing.version !== manifest.version) {
        throw new Error(`Duplicate provider id ${manifest.id} has incompatible sources or versions`)
      }
    } else {
      manifests.push(manifest)
    }
    for (const included of manifest.includes ?? []) {
      if (!expandedSources.has(included)) {
        expandedSources.add(included)
        pending.push(included)
      }
    }
  }
  assertCompatiblePortalVersions(manifests)
  return sortPortalManifests(manifests)
}

export const sortPortalManifests = (manifests) => {
  const byId = new Map()
  const journalTables = new Map()
  for (const manifest of manifests) {
    if (byId.has(manifest.id)) throw new Error(`Duplicate provider id: ${manifest.id}`)
    const table = providerTable(manifest.id)
    if (journalTables.has(table)) {
      throw new Error(`Provider ids ${journalTables.get(table)} and ${manifest.id} resolve to the same migration journal`)
    }
    byId.set(manifest.id, manifest)
    journalTables.set(table, manifest.id)
  }
  for (const manifest of manifests) {
    for (const dependency of manifest.dependsOn ?? []) {
      if (!byId.has(dependency)) throw new Error(`Provider ${manifest.id} depends on missing provider ${dependency}`)
    }
  }
  const visiting = new Set()
  const visited = new Set()
  const ordered = []
  const visit = (manifest) => {
    if (visited.has(manifest.id)) return
    if (visiting.has(manifest.id)) throw new Error(`Migration dependency cycle includes ${manifest.id}`)
    visiting.add(manifest.id)
    for (const id of manifest.dependsOn ?? []) visit(byId.get(id))
    visiting.delete(manifest.id)
    visited.add(manifest.id)
    ordered.push(manifest)
  }
  manifests.forEach(visit)
  return ordered
}

const quoteIdentifier = value => `"${value.replaceAll('"', '""')}"`
const checksum = source => createHash('sha256').update(source).digest('hex')

const migrationFiles = (manifest) => {
  if (!manifest.migrations) return []
  const directory = isAbsolute(manifest.migrations)
    ? manifest.migrations
    : resolve(manifest.root, manifest.migrations)
  if (!existsSync(directory)) throw new Error(`Migration directory does not exist for ${manifest.id}: ${directory}`)
  return readdirSync(directory)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = readFileSync(resolve(directory, name), 'utf8')
      return { name, sql, checksum: checksum(sql) }
    })
}

const requireDatabaseUrl = value => value || process.env.DATABASE_URL || (() => { throw new Error('DATABASE_URL is required') })()
const withPool = async (databaseUrl, callback) => {
  const pool = new Pool({ connectionString: requireDatabaseUrl(databaseUrl), max: 1 })
  try {
    return await callback(pool)
  } finally {
    await pool.end()
  }
}

const ensureJournal = async (client, manifest) => {
  const table = providerTable(manifest.id)
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(migrationSchema)}`)
  await client.query(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(migrationSchema)}.${quoteIdentifier(table)} (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    package_version text NOT NULL,
    applied_at timestamptz DEFAULT now() NOT NULL
  )`)
  return table
}

const appliedMigrations = async (client, manifest) => {
  const table = await ensureJournal(client, manifest)
  const result = await client.query(`SELECT name, checksum, package_version AS "packageVersion", applied_at AS "appliedAt"
    FROM ${quoteIdentifier(migrationSchema)}.${quoteIdentifier(table)} ORDER BY name`)
  return { table, rows: result.rows }
}

export const inspectPortalMigrations = async (config, options = {}) => {
  const manifests = await resolvePortalManifests(config, options.cwd)
  return withPool(options.databaseUrl, async (pool) => {
    const client = await pool.connect()
    try {
      const providers = []
      for (const manifest of manifests.filter(item => item.migrations)) {
        const files = migrationFiles(manifest)
        const { rows } = await appliedMigrations(client, manifest)
        const applied = new Map(rows.map(row => [row.name, row]))
        for (const file of files) {
          const row = applied.get(file.name)
          if (row && row.checksum !== file.checksum) throw new Error(`Checksum mismatch: ${manifest.id}/${file.name}`)
        }
        providers.push({ id: manifest.id, version: manifest.version, applied: rows.length, pending: files.filter(file => !applied.has(file.name)).map(file => file.name) })
      }
      return providers
    } finally {
      client.release()
    }
  })
}

export const migratePortalDatabase = async (config, options = {}) => {
  const manifests = await resolvePortalManifests(config, options.cwd)
  return withPool(options.databaseUrl, async (pool) => {
    const client = await pool.connect()
    const appliedResult = []
    try {
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockName])
      for (const manifest of manifests.filter(item => item.migrations)) {
        const files = migrationFiles(manifest)
        const { table, rows } = await appliedMigrations(client, manifest)
        const applied = new Map(rows.map(row => [row.name, row]))
        for (const file of files) {
          const existing = applied.get(file.name)
          if (existing?.checksum !== file.checksum) throw new Error(`Checksum mismatch: ${manifest.id}/${file.name}`)
          if (existing) continue
          await client.query('BEGIN')
          try {
            await client.query(file.sql)
            await client.query(`INSERT INTO ${quoteIdentifier(migrationSchema)}.${quoteIdentifier(table)} (name, checksum, package_version) VALUES ($1, $2, $3)`, [file.name, file.checksum, manifest.version])
            await client.query('COMMIT')
            appliedResult.push(`${manifest.id}/${file.name}`)
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          }
        }
      }
      return appliedResult
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]).catch(() => {})
      client.release()
    }
  })
}

const verifyLegacyDatabase = async (client) => {
  const journal = await client.query(`SELECT to_regclass('drizzle.__drizzle_migrations') AS journal`)
  if (!journal.rows[0]?.journal) throw new Error('Legacy Drizzle journal was not found')
  const count = await client.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations')
  if (count.rows[0]?.count !== 22) throw new Error(`Expected the recognized 22-entry legacy journal, found ${count.rows[0]?.count ?? 0}`)
  const shape = await client.query(`SELECT
    to_regclass('public.user') IS NOT NULL AS core,
    to_regclass('service_requests.service_request') IS NOT NULL AS service_requests,
    to_regclass('timesheets.workspace_settings') IS NOT NULL AS timesheets`)
  if (!shape.rows[0]?.core || !shape.rows[0]?.service_requests || !shape.rows[0]?.timesheets) {
    throw new Error('Legacy database schema does not match the recognized Customer Portal baseline')
  }
}

export const adoptLegacyMigrations = async (config, options = {}) => {
  const manifests = (await resolvePortalManifests(config, options.cwd)).filter(item => item.migrations)
  return withPool(options.databaseUrl, async (pool) => {
    const client = await pool.connect()
    try {
      await verifyLegacyDatabase(client)
      const mapping = manifests.map(manifest => ({ id: manifest.id, files: migrationFiles(manifest).map(file => file.name) }))
      if (!options.apply) return { dryRun: true, mapping }
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockName])
      try {
        for (const manifest of manifests) {
          const files = migrationFiles(manifest)
          const { table, rows } = await appliedMigrations(client, manifest)
          if (rows.length) throw new Error(`Provider ${manifest.id} already has an adoption journal`)
          await client.query('BEGIN')
          try {
            for (const file of files) {
              await client.query(`INSERT INTO ${quoteIdentifier(migrationSchema)}.${quoteIdentifier(table)} (name, checksum, package_version) VALUES ($1, $2, $3)`, [file.name, file.checksum, manifest.version])
            }
            await client.query('COMMIT')
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          }
        }
      } finally {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName])
      }
      return { dryRun: false, mapping }
    } finally {
      client.release()
    }
  })
}
