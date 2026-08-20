import { createHash, randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
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

export const definePortalConfig = ({ layers, clients }) => {
  if (!Array.isArray(layers) || !layers.length) throw new Error('Portal config must contain at least one layer')
  return {
    layers,
    clients: { defaultModules: [...(clients?.defaultModules ?? [])] },
    nuxtLayers: layers.map(layer => typeof layer === 'string' ? layer : layer.source)
  }
}

export const migrateGenericClients = async (config, options = {}) => {
  const provider = assertString(options.provider, '--provider')
  return withPool(options.databaseUrl, async (pool) => {
    const client = await pool.connect()
    try {
      const selected = await client.query('SELECT id, name, slug FROM organization WHERE id = $1 OR slug = $1', [provider])
      if (selected.rowCount !== 1) throw new Error(`Expected exactly one organization for --provider ${provider}, found ${selected.rowCount}`)
      const providerOrganization = selected.rows[0]
      // Check the one-time journal before inspecting legacy tables. A successful
      // run may have removed those tables, so a retry must be able to skip cleanly.
      if (options.apply && options.once) {
        const migrationJournal = await client.query(`SELECT to_regclass('${migrationSchema}.one_time_migration') AS table_name`)
        if (migrationJournal.rows[0]?.table_name) {
          const applied = await client.query(`SELECT provider_id, applied_at FROM ${quoteIdentifier(migrationSchema)}."one_time_migration" WHERE migration_key = $1`, ['generic-clients-v1'])
          if (applied.rowCount) {
            if (applied.rows[0].provider_id !== providerOrganization.id) {
              throw new Error(`Generic Clients migration was already applied for provider ${applied.rows[0].provider_id}`)
            }
            return { dryRun: false, skipped: true, alreadyApplied: applied.rows[0] }
          }
        }
      }
      const linked = await client.query(`SELECT o.id, o.name, o.slug
        FROM timesheets.workspace_client wc JOIN organization o ON o.id = wc.client_organization_id
        WHERE wc.workspace_organization_id = $1 AND o.id <> $1 ORDER BY o.name`, [providerOrganization.id])
      const allOthers = await client.query('SELECT id, name, slug FROM organization WHERE id <> $1 ORDER BY name', [providerOrganization.id])
      const secondaryWorkspaces = await client.query(`SELECT workspace_organization_id AS "organizationId", count(*)::int AS "clientLinks"
        FROM timesheets.workspace_client WHERE workspace_organization_id <> $1
        GROUP BY workspace_organization_id ORDER BY workspace_organization_id`, [providerOrganization.id])
      const linkedIds = new Set(linked.rows.map(row => row.id))
      const archived = allOthers.rows.filter(row => !linkedIds.has(row.id))
      const legacyContacts = await client.query(`SELECT to_regclass('timesheets.organization_contact') AS table_name`)
      const contacts = legacyContacts.rows[0]?.table_name
        ? await client.query(`SELECT count(*)::int AS total,
          count(*) FILTER (WHERE oc.user_id IS NOT NULL AND m.id IS NOT NULL)::int AS linked
          FROM timesheets.organization_contact oc
          LEFT JOIN member m ON m.user_id = oc.user_id AND m.organization_id = oc.organization_id`)
        : { rows: [{ total: 0, linked: 0 }] }
      const legacyInvoiceProfiles = await client.query(`SELECT to_regclass('timesheets.organization_invoice_profile') AS table_name`)
      const serviceRequestTables = await client.query(`SELECT
        to_regclass('service_requests.legacy_service_request') AS legacy_table,
        to_regclass('service_requests.service_request') AS current_table`)
      const legacyServiceRequestTable = serviceRequestTables.rows[0]?.legacy_table
      const currentServiceRequestTable = serviceRequestTables.rows[0]?.current_table
      const requests = legacyServiceRequestTable
        ? await client.query('SELECT count(*)::int AS total FROM service_requests.legacy_service_request')
        : currentServiceRequestTable
          ? await client.query('SELECT count(*)::int AS total FROM service_requests.service_request')
          : { rows: [{ total: 0 }] }
      const defaultModules = [...new Set(config.clients?.defaultModules ?? [])]
      const report = {
        dryRun: !options.apply,
        provider: providerOrganization,
        activeClients: linked.rows,
        archivedUnclassifiedOrganizations: archived,
        skippedContacts: (contacts.rows[0]?.total ?? 0) - (contacts.rows[0]?.linked ?? 0),
        excludedSecondaryWorkspaceData: secondaryWorkspaces.rows,
        excludedServiceRequests: requests.rows[0]?.total ?? 0,
        inferredModules: linked.rows.map(row => ({ organizationId: row.id, moduleId: 'timesheets' })),
        defaultModules,
        blockingIntegrityErrors: []
      }
      if (!options.apply) return report
      if (!options.backupConfirmed) throw new Error('Applying this migration requires --backup-confirmed')
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [`${lockName}:generic-clients`])
      await client.query('BEGIN')
      try {
        if (options.once) {
          await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(migrationSchema)}`)
          await client.query(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(migrationSchema)}."one_time_migration" (
            migration_key text PRIMARY KEY,
            provider_id text NOT NULL,
            applied_at timestamptz DEFAULT now() NOT NULL
          )`)
          const applied = await client.query(`SELECT provider_id, applied_at FROM ${quoteIdentifier(migrationSchema)}."one_time_migration" WHERE migration_key = $1`, ['generic-clients-v1'])
          if (applied.rowCount) {
            if (applied.rows[0].provider_id !== providerOrganization.id) {
              await client.query('ROLLBACK')
              throw new Error(`Generic Clients migration was already applied for provider ${applied.rows[0].provider_id}`)
            }
            await client.query('ROLLBACK')
            return { ...report, dryRun: false, skipped: true, alreadyApplied: applied.rows[0] }
          }
        }
        await client.query(`UPDATE organization SET organization_type = CASE WHEN id = $1 THEN 'PROVIDER' ELSE 'CLIENT' END`, [providerOrganization.id])
        await client.query(`INSERT INTO clients.client_profile
          (organization_id, official_name, address, registration_number, vat_number, invoice_email, preferred_locale, archived_at)
          SELECT o.id, o.name, ${legacyInvoiceProfiles.rows[0]?.table_name ? "COALESCE(p.address, ''), p.registration_number, p.vat_number, p.invoice_email, COALESCE(p.preferred_locale, 'nl')" : "'', NULL, NULL, NULL, 'nl'"},
            CASE WHEN wc.id IS NULL THEN now() ELSE NULL END
          FROM organization o
          ${legacyInvoiceProfiles.rows[0]?.table_name ? 'LEFT JOIN timesheets.organization_invoice_profile p ON p.organization_id = o.id' : ''}
          LEFT JOIN timesheets.workspace_client wc ON wc.client_organization_id = o.id AND wc.workspace_organization_id = $1
          WHERE o.id <> $1
          ON CONFLICT (organization_id) DO NOTHING`, [providerOrganization.id])
        if (legacyContacts.rows[0]?.table_name) {
          await client.query(`WITH ranked_contacts AS (
            SELECT DISTINCT ON (oc.organization_id, oc.user_id)
              oc.organization_id, oc.user_id, oc.phone, oc.job_title
            FROM timesheets.organization_contact oc
            WHERE oc.user_id IS NOT NULL
            ORDER BY oc.organization_id, oc.user_id, oc.updated_at DESC, oc.id DESC
          )
          UPDATE member m
          SET phone = COALESCE(rc.phone, m.phone), job_title = COALESCE(rc.job_title, m.job_title)
          FROM ranked_contacts rc
          WHERE m.organization_id = rc.organization_id AND m.user_id = rc.user_id`)
        }
        const activations = new Set(['timesheets', ...defaultModules])
        for (const row of linked.rows) {
          for (const moduleId of activations) {
            await client.query(`INSERT INTO clients.client_module (id, organization_id, module_id, enabled)
              VALUES (gen_random_uuid()::text, $1, $2, true)
              ON CONFLICT (organization_id, module_id) DO UPDATE SET enabled = true, updated_at = now()`, [row.id, moduleId])
          }
        }
        // The required-client migration already snapshots and clears legacy
        // requests. Preserve current-format requests if no legacy snapshot exists.
        if (currentServiceRequestTable && legacyServiceRequestTable) {
          await client.query('TRUNCATE service_requests.service_request')
        }
        if (options.once) {
          await client.query(`INSERT INTO ${quoteIdentifier(migrationSchema)}."one_time_migration" (migration_key, provider_id) VALUES ($1, $2)`, ['generic-clients-v1', providerOrganization.id])
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`${lockName}:generic-clients`]).catch(() => {})
      }
      return { ...report, dryRun: false }
    } finally {
      client.release()
    }
  })
}

export const seedPortalProvider = async (options = {}) => {
  const name = assertString(options.organizationName, '--organization-name')
  const slug = assertString(options.organizationSlug, '--organization-slug')
  const userName = assertString(options.userName, '--user-name')
  const email = assertString(options.userEmail, '--user-email').toLowerCase()
  const password = assertString(options.userPassword, '--user-password')
  return withPool(options.databaseUrl, async (pool) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existingProvider = await client.query(`SELECT id, slug FROM organization WHERE organization_type = 'PROVIDER' LIMIT 1`)
      if (existingProvider.rowCount && existingProvider.rows[0].slug !== slug) throw new Error(`A PROVIDER organization already exists with slug ${existingProvider.rows[0].slug}`)
      const organizationId = existingProvider.rows[0]?.id ?? randomUUID()
      await client.query(`INSERT INTO organization (id, name, slug, organization_type, created_at)
        VALUES ($1, $2, $3, 'PROVIDER', now()) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`, [organizationId, name, slug])
      const existingUser = await client.query('SELECT id FROM "user" WHERE lower(email) = $1', [email])
      const userId = existingUser.rows[0]?.id ?? randomUUID()
      if (!existingUser.rowCount) {
        const passwordHash = await hashPassword(password)
        await client.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, true, now(), now())`, [userId, userName, email])
        await client.query(`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
          VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [randomUUID(), userId, passwordHash])
      }
      await client.query(`INSERT INTO member (id, organization_id, user_id, role, created_at)
        SELECT $1, $2, $3, 'owner', now()
        WHERE NOT EXISTS (SELECT 1 FROM member WHERE organization_id = $2 AND user_id = $3)`, [randomUUID(), organizationId, userId])
      await client.query('COMMIT')
      return { organizationId, userId, email, createdUser: !existingUser.rowCount }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}

/**
 * Grants the global platform-admin role to an existing user. Organization
 * membership and organization roles are intentionally left untouched.
 */
export const assignPortalSystemAdmin = async (options = {}) => {
  const email = assertString(options.email, '--email').trim().toLowerCase()
  return withPool(options.databaseUrl, async (pool) => {
    const client = await pool.connect()
    try {
      const result = await client.query(
        `UPDATE "user"
          SET role = 'admin', updated_at = now()
          WHERE lower(email) = $1
          RETURNING id, name, email, role`,
        [email]
      )
      if (result.rowCount !== 1) {
        throw new Error(`Expected exactly one existing user for --email ${email}, found ${result.rowCount}`)
      }
      return result.rows[0]
    } finally {
      client.release()
    }
  })
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
  const sorted = sortPortalManifests(manifests)
  const supportedClientModules = new Set(sorted.map(item => item.clientModuleId).filter(Boolean))
  for (const moduleId of config.clients?.defaultModules ?? []) {
    if (!supportedClientModules.has(moduleId)) throw new Error(`Configured default client module is not installed or client-aware: ${moduleId}`)
  }
  return sorted
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
          if (existing && existing.checksum !== file.checksum) throw new Error(`Checksum mismatch: ${manifest.id}/${file.name}`)
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
      // The recognized 22-entry legacy journal predates provider-owned migration
      // streams. It represents only the original baselines of these providers.
      // New providers and follow-up migrations must remain pending and execute
      // normally after adoption.
      const legacyProviderIds = new Set(['core', 'service-requests', 'timesheets'])
      const mapping = manifests
        .filter(manifest => legacyProviderIds.has(manifest.id))
        .map(manifest => ({
          id: manifest.id,
          files: migrationFiles(manifest).filter(file => file.name === '0000_baseline.sql').map(file => file.name)
        }))
      if (!options.apply) return { dryRun: true, mapping }
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockName])
      try {
        for (const { id, files: adoptedNames } of mapping) {
          const manifest = manifests.find(item => item.id === id)
          if (!manifest) throw new Error(`Legacy provider manifest is missing: ${id}`)
          const adoptedNameSet = new Set(adoptedNames)
          const files = migrationFiles(manifest).filter(file => adoptedNameSet.has(file.name))
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
