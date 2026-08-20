import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { account, session, user, verification } from '@nuxt-customer-portal/core/schema'
import { getPlatformDatabase } from './tenant-runtime'
import { isPlatformAdminEmail } from './platform-admin'

const githubEnabled = process.env.PORTAL_GITHUB_ENABLED === 'true'
const googleEnabled = process.env.PORTAL_GOOGLE_ENABLED === 'true'

export const platformAuth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || `https://${process.env.SAAS_PLATFORM_HOST || 'platform.localhost'}`,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getPlatformDatabase(), {
    provider: 'pg',
    schema: { user, account, session, verification },
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
  plugins: [admin({ defaultRole: 'user' })]
})
