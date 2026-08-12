import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { sendEmail } from './email'
import { getInvitationEmailContent, getOTPEmailContent, getDeleteAccountEmailContent } from './email-texts'
import { customSession, emailOTP, openAPI, organization } from 'better-auth/plugins'
import { db } from './db'
import { and, eq, gt, or } from 'drizzle-orm'
import { user as userTable, account as accountTable, session as sessionTable, verification as verificationTable, organization as organizationTable, member as organizationMemberTable, invitation as organizationInvitationTable } from '../db/schema/auth-schema'
import { nanoid } from 'nanoid'

/**
 * Generate an ID in the same format as better-auth uses (nanoid)
 * This ensures consistency across all ID generation in the application
 */
export function generateId(): string {
  return nanoid()
}

const envFlag = (value: string | undefined, fallback = true) => value === undefined ? fallback : value === 'true'
const portalAuthConfig = useRuntimeConfig().portalAuth
const registrationMode = ['open', 'invitation-only', 'disabled'].includes(process.env.PORTAL_REGISTRATION_MODE || '')
  ? process.env.PORTAL_REGISTRATION_MODE
  : portalAuthConfig.registrationMode
const githubEnabled = envFlag(process.env.PORTAL_GITHUB_ENABLED, portalAuthConfig.githubEnabled)
const googleEnabled = envFlag(process.env.PORTAL_GOOGLE_ENABLED, portalAuthConfig.googleEnabled)

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3051',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: userTable,
      account: accountTable,
      session: sessionTable,
      member: organizationMemberTable,
      verification: verificationTable,
      organization: organizationTable,
      invitation: organizationInvitationTable,
    },
    usePlural: false,
    // Tables are singular (e.g., "user"), so no need for usePlural
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: registrationMode === 'disabled',
    requireEmailVerification: true
  },
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token: _token }, _request) => {
        // url is already a full URL from better-auth, use it directly
        const emailContent = getDeleteAccountEmailContent({
          userName: user.name || '',
          userEmail: user.email,
          deletionLink: url
        })

        await sendEmail({
          to: user.email,
          ...emailContent
        })
      },
    }
  },
  socialProviders: {
    ...(githubEnabled && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET
        } }
      : {}),
    ...(googleEnabled && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        } }
      : {})
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (registrationMode !== 'invitation-only') return

          const [invitation] = await db
            .select({ id: organizationInvitationTable.id })
            .from(organizationInvitationTable)
            .where(and(
              eq(organizationInvitationTable.email, user.email),
              eq(organizationInvitationTable.status, 'pending'),
              gt(organizationInvitationTable.expiresAt, new Date())
            ))
            .limit(1)

          if (!invitation) {
            throw new APIError('FORBIDDEN', { message: 'Registration requires a valid invitation' })
          }
        },
      }
    }
  },
  plugins: [
    openAPI({
      disableDefaultReference: true
    }),
    organization({
      allowUserToCreateOrganization: false,
      schema: {
        organization: {
          additionalFields: {
            organizationType: { type: 'string', required: true, input: true }
          }
        },
        member: {
          additionalFields: {
            phone: { type: 'string', required: false, input: true },
            jobTitle: { type: 'string', required: false, input: true }
          }
        }
      },
      sendInvitationEmail: async ({ invitation, organization, inviter }) => {
        const baseURL = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3000'
        const invitationLink = `${baseURL}/signup?invitationId=${invitation.id}`

        const emailContent = getInvitationEmailContent({
          inviterName: inviter.user.name || '',
          inviterEmail: inviter.user.email,
          organizationName: organization.name,
          role: invitation.role || 'member',
          invitationLink
        })

        await sendEmail({
          to: invitation.email,
          ...emailContent
        })
      },
      organizationHooks: {
        afterAcceptInvitation: async ({ invitation: _invitation, member, user, organization }) => {
          // Ensure the user gets the correct role when accepting invitation
          // Better Auth handles this automatically, but we log it for debugging
          console.log(`User ${user.email} accepted invitation to ${organization.name} with role ${member.role}`)
        }
      }
    }),
    emailOTP({
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        const config = useRuntimeConfig()
        const emailContent = getOTPEmailContent({
          otp,
          type,
          brandName: config.portalEmail?.brandName
        })

        await sendEmail({
          to: email,
          ...emailContent
        })
      }
    }),
    customSession(async (sessionData) => {
      // Destructure user and session from the input object
      const { user, session } = sessionData
      // Fetch the account for the user
      const [account] = await db
        .select({ providerId: accountTable.providerId })
        .from(accountTable)
        .where(eq(accountTable.userId, user.id))
        .limit(1)

      // Return modified session data
      return {
        ...session, // Spread the original session part
        user: {
          ...user, // Spread the original user part
          providerId: account?.providerId || null // Add providerId to user object
        }
      }
    })
  ]
})
