import type { PoolClient } from 'pg'
import type { H3Event } from 'h3'
import sharp from 'sharp'
import { getSession } from '@nuxt-customer-portal/core/server'
import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import {
  defaultPortalSettings,
  portalOnboardingSteps,
  portalSettingsSchema,
  type PortalOnboardingState,
  type PortalOnboardingStep,
  type PortalSettings
} from '../../shared/settings'

interface SettingsRow {
  settings: PortalSettings
  onboarding_step: string
  completed_at: Date | null
}

const reservedAdminEmails = () =>
  new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )

export async function readPortalSettings(): Promise<{
  settings: PortalSettings
  step: PortalOnboardingStep
  completed: boolean
}> {
  const result = await pool.query<SettingsRow>(
    'SELECT settings, onboarding_step, completed_at FROM saas_configuration.portal_settings WHERE id=true'
  )
  const row = result.rows[0]
  if (row) {
    const step =
      row.onboarding_step === 'appearance'
        ? 'branding'
        : portalOnboardingSteps.includes(row.onboarding_step as PortalOnboardingStep)
          ? (row.onboarding_step as PortalOnboardingStep)
          : 'branding'
    return {
      settings: portalSettingsSchema.parse({
        ...row.settings,
        clients: row.settings.clients ?? useRuntimeConfig().public.clients
      }),
      step,
      completed: Boolean(row.completed_at)
    }
  }
  const defaults = defaultPortalSettings(process.env.PORTAL_PROVIDER_NAME || 'Customer Portal')
  defaults.clients = portalSettingsSchema.parse({ ...defaults, clients: useRuntimeConfig().public.clients }).clients
  await pool.query(
    `INSERT INTO saas_configuration.portal_settings (id, settings) VALUES (true, $1::jsonb) ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(defaults)]
  )
  return { settings: defaults, step: 'branding', completed: false }
}

export async function readPortalOnboardingState(): Promise<PortalOnboardingState> {
  const [admin, stored] = await Promise.all([
    pool.query<{ exists: boolean }>(`SELECT EXISTS(SELECT 1 FROM "user" WHERE role='admin') AS exists`),
    readPortalSettings()
  ])
  return { adminExists: Boolean(admin.rows[0]?.exists), completed: stored.completed, step: stored.step }
}

export async function requirePortalSettingsAdmin(event: H3Event) {
  const session = await getSession(event)
  if (!session?.user || session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'System administrator access required' })
  }
  return session
}

export async function validatePortalBrandImages(settings: PortalSettings) {
  for (const [name, value] of Object.entries(settings.branding)) {
    if (!name.toLowerCase().includes('logo') && !name.toLowerCase().includes('mark')) {
      continue
    }
    if (!value) {
      continue
    }
    const encoded = String(value).split(',', 2)[1] || ''
    const buffer = Buffer.from(encoded, 'base64')
    if (buffer.length > 2_000_000) {
      throw createError({ statusCode: 400, message: `${name} must be smaller than 2 MB` })
    }
    try {
      const metadata = await sharp(buffer).metadata()
      if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || !metadata.width || !metadata.height) {
        throw new Error('Unsupported image')
      }
      if (metadata.width > 2400 || metadata.height > 2400) {
        throw createError({ statusCode: 400, message: `${name} dimensions must not exceed 2400×2400` })
      }
      if (name.startsWith('mark') && (metadata.width < 64 || metadata.height < 64)) {
        throw createError({ statusCode: 400, message: `${name} must be at least 64×64` })
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 400, message: `${name} is not a valid image` })
    }
  }
}

async function validateClientSettings(client: PoolClient, settings: PortalSettings) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('portal-client-configuration'))")
  const config = useRuntimeConfig()
  const mode = process.env.PORTAL_REGISTRATION_MODE || config.portalAuth.registrationMode
  if (settings.clients.personalSelfRegistration && mode !== 'open') {
    throw createError({
      statusCode: 400,
      message: 'Personal self-registration requires open authentication registration'
    })
  }
  const table = await client.query("SELECT to_regclass('clients.client_profile') AS name")
  if (table.rows[0]?.name) {
    const existing = await client.query(
      'SELECT DISTINCT client_type FROM clients.client_profile WHERE NOT (client_type = ANY($1::text[]))',
      [settings.clients.allowedTypes]
    )
    if (existing.rows.length) {
      throw createError({ statusCode: 409, message: 'Cannot disable a client type while clients of that type exist' })
    }
  }
}

export async function writePortalSettings(input: unknown, requestedStep?: unknown) {
  const settings = portalSettingsSchema.parse(input)
  await validatePortalBrandImages(settings)
  const step = portalOnboardingSteps.includes(requestedStep as PortalOnboardingStep)
    ? (requestedStep as PortalOnboardingStep)
    : undefined
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await validateClientSettings(client, settings)
    await client.query(
      `UPDATE saas_configuration.portal_settings SET settings=$1::jsonb, onboarding_step=COALESCE($2,onboarding_step), updated_at=now() WHERE id=true`,
      [JSON.stringify(settings), step || null]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return { settings, step: step || (await readPortalSettings()).step }
}

export async function completePortalOnboarding(input: unknown) {
  const settings = portalSettingsSchema.parse(input)
  await validatePortalBrandImages(settings)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await validateClientSettings(client, settings)
    await client.query(
      `UPDATE saas_configuration.portal_settings SET settings=$1::jsonb, onboarding_step='review', completed_at=now(), updated_at=now() WHERE id=true`,
      [JSON.stringify(settings)]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return { settings, step: 'review' as const, completed: true }
}

export function isReservedPortalAdmin(email: unknown) {
  return typeof email === 'string' && reservedAdminEmails().has(email.trim().toLowerCase())
}
