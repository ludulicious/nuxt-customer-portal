import { randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { migratePortalDatabase, seedPortalProvider } from '@nuxt-customer-portal/kit'
import portal from '../../../portal.config'
import { requirePlatformSession } from '../../utils/platform-access'
import { deleteTenantAuthSecret, deleteTenantDatabaseSecret, provisionTenantDatabase, storeTenantAuthSecret, storeTenantDatabaseSecret } from '../../utils/provider-adapters'
import { getControlPlanePool } from '../../utils/tenant-runtime'

const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  modules: z.array(z.enum(['timesheets', 'invoices', 'service-requests'])).min(1),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.email(),
  adminPassword: z.string().min(12).max(256),
  database: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('managed') }),
    z.object({ mode: z.literal('byod'), url: z.url().refine(value => value.startsWith('postgresql://') || value.startsWith('postgres://'), 'PostgreSQL URL required') })
  ])
})

export default defineEventHandler(async (event) => {
  const platformSession = await requirePlatformSession(event)
  const input = onboardingSchema.parse(await readBody(event))
  const tenantId = randomUUID()
  const onboardingId = randomUUID()
  const platformDomain = String(useRuntimeConfig().public.platformDomain)
  const canonicalDomain = `${input.slug}.${platformDomain}`
  const provisioned = input.database.mode === 'managed'
    ? await provisionTenantDatabase(tenantId, input.slug)
    : { url: input.database.url, resourceId: null }

  let databaseSecretStored = false
  let authSecretStored = false
  try {
    await migratePortalDatabase(portal, { cwd: process.cwd(), databaseUrl: provisioned.url })
    await seedPortalProvider({
      databaseUrl: provisioned.url,
      organizationName: input.companyName,
      organizationSlug: input.slug,
      userName: input.adminName,
      userEmail: input.adminEmail,
      userPassword: input.adminPassword,
      memberRole: 'admin'
    })
    const databaseSecret = await storeTenantDatabaseSecret(tenantId, provisioned.url)
    databaseSecretStored = true
    const authSecret = randomBytes(48).toString('base64url')
    const storedAuthSecret = await storeTenantAuthSecret(tenantId, authSecret)
    authSecretStored = true

    const client = await getControlPlanePool().connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO platform_tenant
          (id, slug, lifecycle_status, canonical_domain, database_secret_ref, auth_secret_ref, database_mode, database_provider_resource_id, selected_modules, schema_version, application_version)
         VALUES ($1, $2, 'ACTIVE', $3, $4, $5, $6, $7, $8::jsonb, 'current', '0.1.0-alpha.0')`,
        [tenantId, input.slug, canonicalDomain, databaseSecret.reference, storedAuthSecret.reference, input.database.mode, provisioned.resourceId, JSON.stringify(input.modules)]
      )
      await client.query(
        `INSERT INTO platform_domain (id, tenant_id, hostname, verified_at, is_canonical)
         VALUES ($1, $2, $3, now(), true)`,
        [randomUUID(), tenantId, canonicalDomain]
      )
      await client.query(
        `INSERT INTO platform_onboarding
          (id, tenant_id, company_name, slug, admin_email, selected_modules, database_mode, status, provisioning_step, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'ACTIVE', 'COMPLETE', $8)`,
        [onboardingId, tenantId, input.companyName, input.slug, input.adminEmail, JSON.stringify(input.modules), input.database.mode, platformSession.user.id]
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return { tenantId, slug: input.slug, canonicalDomain, createdBy: platformSession.user.id }
  } catch (error) {
    if (authSecretStored) await deleteTenantAuthSecret(tenantId)
    if (databaseSecretStored) await deleteTenantDatabaseSecret(tenantId)
    throw error
  }
})
