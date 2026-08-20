import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, organization as organizationPlugin } from 'better-auth/plugins'
import { account, invitation, member, organization, session, user, verification } from '@nuxt-customer-portal/core/schema'
import { getPlatformDatabase, getControlPlanePool } from './workspace-runtime'
import { isPlatformAdminEmail } from './platform-admin'

const githubEnabled = process.env.PORTAL_GITHUB_ENABLED === 'true'
const googleEnabled = process.env.PORTAL_GOOGLE_ENABLED === 'true'
const platformBaseURL = process.env.BETTER_AUTH_URL || `https://${process.env.SAAS_PLATFORM_HOST || 'platform.localhost'}`
const platformDevURL = `http://${process.env.SAAS_PLATFORM_HOST || 'platform.localhost'}:3053`
const trustedOrigins = [...new Set([
  platformBaseURL,
  platformDevURL,
  process.env.PUBLIC_URL,
  process.env.NUXT_PUBLIC_SITE_URL
].filter((origin): origin is string => Boolean(origin)))]

export const platformAuth = betterAuth({
  baseURL: platformBaseURL,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getPlatformDatabase(), {
    provider: 'pg',
    schema: { user, account, session, verification, organization, member, invitation },
    usePlural: false
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.PORTAL_REGISTRATION_MODE === 'disabled',
    requireEmailVerification: false
  },
  databaseHooks: {
    user: {
      create: {
        before: async platformUser => ({
          data: {
            ...platformUser,
            role: isPlatformAdminEmail(platformUser.email) ? 'admin' : 'user'
          }
        })
      }
    },
    session: {
      create: {
        after: async platformSession => {
          const result = await getControlPlanePool().query<{ email: string }>(
            'SELECT email FROM "user" WHERE id = $1 LIMIT 1',
            [platformSession.userId]
          )
          const platformUser = result.rows[0]

          if (!platformUser) return

          const isPlatformAdmin = isPlatformAdminEmail(platformUser.email)
          await getControlPlanePool().query(
            'UPDATE "user" SET role = $2, updated_at = now() WHERE id = $1',
            [platformSession.userId, isPlatformAdmin ? 'admin' : 'user']
          )

          if (!isPlatformAdmin) return

          const provider = await getControlPlanePool().query<{ id: string }>(
            `SELECT id FROM organization WHERE organization_type = 'PROVIDER' LIMIT 1`
          )
          const providerOrganizationId = provider.rows[0]?.id ?? randomUUID()
          if (!provider.rows[0]) {
            await getControlPlanePool().query(
              `INSERT INTO organization (id, name, slug, organization_type, created_at)
               VALUES ($1, 'Platform', 'platform', 'PROVIDER', now())`,
              [providerOrganizationId]
            )
          }
          await getControlPlanePool().query(
            `INSERT INTO member (id, organization_id, user_id, role, created_at)
             SELECT $1, $2, $3, 'owner', now()
             WHERE NOT EXISTS (
               SELECT 1 FROM member WHERE organization_id = $2 AND user_id = $3
             )`,
            [randomUUID(), providerOrganizationId, platformSession.userId]
          )
        }
      }
    }
  },
  socialProviders: {
    ...(githubEnabled && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
      : {}),
    ...(googleEnabled && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {})
  },
  plugins: [
    organizationPlugin({
      allowUserToCreateOrganization: false,
      schema: {
        organization: {
          additionalFields: {
            organizationType: { type: 'string', required: true, input: true }
          }
        }
      }
    }),
    admin({ defaultRole: 'user' })
  ]
})
