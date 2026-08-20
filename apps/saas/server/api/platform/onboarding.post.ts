import { randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { migratePortalDatabase, seedPortalProvider } from '@nuxt-customer-portal/kit'
import portal from '../../../portal.config'
import { requirePlatformSession } from '../../utils/platform-access'
import { deleteWorkspaceAuthSecret, deleteWorkspaceDatabaseSecret, provisionWorkspaceDatabase, storeWorkspaceAuthSecret, storeWorkspaceDatabaseSecret } from '../../utils/provider-adapters'
import { getControlPlanePool } from '../../utils/workspace-runtime'

const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  modules: z.array(z.enum(['timesheets', 'invoices'])).min(1),
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
  const workspaceId = randomUUID()
  const onboardingId = randomUUID()
  const platformDomain = String(useRuntimeConfig().public.platformDomain)
  const canonicalDomain = `${input.slug}.${platformDomain}`
  const provisioned = input.database.mode === 'managed'
    ? await provisionWorkspaceDatabase(workspaceId, input.slug)
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
    const databaseSecret = await storeWorkspaceDatabaseSecret(workspaceId, provisioned.url)
    databaseSecretStored = true
    const authSecret = randomBytes(48).toString('base64url')
    const storedAuthSecret = await storeWorkspaceAuthSecret(workspaceId, authSecret)
    authSecretStored = true

    const client = await getControlPlanePool().connect()
    try {
      await client.query('BEGIN')
      const provider = await client.query<{ id: string }>(
        `SELECT id FROM organization WHERE organization_type = 'PROVIDER' LIMIT 1 FOR UPDATE`
      )
      const providerOrganizationId = provider.rows[0]?.id ?? randomUUID()
      if (!provider.rows[0]) {
        await client.query(
          `INSERT INTO organization (id, name, slug, organization_type, created_at)
           VALUES ($1, 'Platform', 'platform', 'PROVIDER', now())`,
          [providerOrganizationId]
        )
      }
      await client.query(
        `INSERT INTO member (id, organization_id, user_id, role, created_at)
         SELECT $1, $2, $3, 'owner', now()
         WHERE NOT EXISTS (
           SELECT 1 FROM member WHERE organization_id = $2 AND user_id = $3
         )`,
        [randomUUID(), providerOrganizationId, platformSession.user.id]
      )
      await client.query(
        `INSERT INTO organization (id, name, slug, organization_type, created_at)
         VALUES ($1, $2, $3, 'CLIENT', now())`,
        [workspaceId, input.companyName, input.slug]
      )
      await client.query(
        `INSERT INTO clients.client_profile (organization_id, official_name, preferred_locale)
         VALUES ($1, $2, 'nl')`,
        [workspaceId, input.companyName]
      )
      for (const moduleId of new Set(input.modules)) {
        await client.query(
          `INSERT INTO clients.client_module (id, organization_id, module_id, enabled, enabled_by_id)
           VALUES ($1, $2, $3, true, $4)`,
          [randomUUID(), workspaceId, moduleId, platformSession.user.id]
        )
      }
      await client.query(
        `INSERT INTO platform_workspace
          (id, slug, lifecycle_status, canonical_domain, database_secret_ref, auth_secret_ref, database_mode, database_provider_resource_id, selected_modules, organization_id, schema_version, application_version)
         VALUES ($1, $2, 'ACTIVE', $3, $4, $5, $6, $7, $8::jsonb, $9, 'current', '0.1.0-alpha.0')`,
        [workspaceId, input.slug, canonicalDomain, databaseSecret.reference, storedAuthSecret.reference, input.database.mode, provisioned.resourceId, JSON.stringify(input.modules), workspaceId]
      )
      await client.query(
        `INSERT INTO platform_domain (id, workspace_id, hostname, verified_at, is_canonical)
         VALUES ($1, $2, $3, now(), true)`,
        [randomUUID(), workspaceId, canonicalDomain]
      )
      await client.query(
        `INSERT INTO platform_onboarding
          (id, workspace_id, company_name, slug, admin_email, selected_modules, database_mode, status, provisioning_step, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'ACTIVE', 'COMPLETE', $8)`,
        [onboardingId, workspaceId, input.companyName, input.slug, input.adminEmail, JSON.stringify(input.modules), input.database.mode, platformSession.user.id]
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return { workspaceId, slug: input.slug, canonicalDomain, createdBy: platformSession.user.id }
  } catch (error) {
    if (authSecretStored) await deleteWorkspaceAuthSecret(workspaceId)
    if (databaseSecretStored) await deleteWorkspaceDatabaseSecret(workspaceId)
    throw error
  }
})
