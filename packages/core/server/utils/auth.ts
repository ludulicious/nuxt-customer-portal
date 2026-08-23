import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { sendEmail } from './email'
import { getInvitationEmailContent, getOTPEmailContent, getDeleteAccountEmailContent } from './email-texts'
import { admin as adminPlugin, customSession, emailOTP, openAPI, organization } from 'better-auth/plugins'
import { db } from './db'
import { and, eq, gt, or } from 'drizzle-orm'
import { user as userTable, account as accountTable, session as sessionTable, verification as verificationTable, organization as organizationTable, member as organizationMemberTable, invitation as organizationInvitationTable } from '../db/schema/auth-schema'
import { nanoid } from 'nanoid'
import { ac, user, admin as adminRole } from '../../shared/permissions'
import { canViewOrganizationDirectory } from '../../shared/feature-registry'
import { isSystemAdminEmail, parseSystemAdminEmails } from './admin-email-allowlist'

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
const systemAdminEmails = parseSystemAdminEmails(process.env.ADMIN_EMAILS)

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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/organization/list-members' && ctx.path !== '/organization/list-invitations') return

      const session = await getSessionFromCtx(ctx)
      if (!session) return
      const organizationId = ctx.query?.organizationId || session.session.activeOrganizationId
      if (!organizationId) return

      const [membership] = await db
        .select({ role: organizationMemberTable.role })
        .from(organizationMemberTable)
        .where(and(
          eq(organizationMemberTable.userId, session.user.id),
          eq(organizationMemberTable.organizationId, String(organizationId))
        ))
        .limit(1)

      if (!canViewOrganizationDirectory(membership?.role)) {
        throw new APIError('FORBIDDEN', { message: 'Organization owner or administrator access required' })
      }
    })
  },
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
      beforeDelete: async (user) => {
        const [record] = await db
          .select({ role: userTable.role })
          .from(userTable)
          .where(eq(userTable.id, user.id))
          .limit(1)

        if (record?.role === 'admin') {
          throw new APIError('BAD_REQUEST', { message: 'System administrator accounts cannot be deleted' })
        }
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
          if (registrationMode === 'invitation-only') {
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
          }

          if (isSystemAdminEmail(user.email, systemAdminEmails)) return { data: { ...user, role: 'admin' } }
        },
        after: async (user) => {
          if (!isSystemAdminEmail(user.email, systemAdminEmails)) return

          const [providerOrganization] = await db
            .select({ id: organizationTable.id })
            .from(organizationTable)
            .where(eq(organizationTable.organizationType, 'PROVIDER'))
            .limit(1)
          if (!providerOrganization) return

          const [membership] = await db
            .select({ id: organizationMemberTable.id })
            .from(organizationMemberTable)
            .where(and(
              eq(organizationMemberTable.organizationId, providerOrganization.id),
              eq(organizationMemberTable.userId, user.id)
            ))
            .limit(1)
          if (membership) return

          await db.insert(organizationMemberTable).values({
            id: generateId(),
            organizationId: providerOrganization.id,
            userId: user.id,
            role: 'owner',
            createdAt: new Date()
          })
        },
      }
    },
    session: {
      create: {
        before: async (session) => {
          const [record] = await db
            .select({ email: userTable.email, role: userTable.role })
            .from(userTable)
            .where(eq(userTable.id, session.userId))
            .limit(1)

          if (record && record.role !== 'admin' && isSystemAdminEmail(record.email, systemAdminEmails)) {
            await db
              .update(userTable)
              .set({ role: 'admin', updatedAt: new Date() })
              .where(eq(userTable.id, session.userId))
          }

          return { data: session }
        }
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
        afterCreateOrganization: async ({ organization: createdOrganization, member, user: creator }) => {
          const [creatorRecord] = await db
            .select({ role: userTable.role })
            .from(userTable)
            .where(eq(userTable.id, creator.id))
            .limit(1)

          // A system admin manages organizations globally and does not need an
          // artificial membership in every organization they create.
          if (creatorRecord?.role === 'admin' && member) {
            await db
              .delete(organizationMemberTable)
              .where(eq(organizationMemberTable.id, member.id))
            console.log(`Removed system admin ${creator.email} as member from ${createdOrganization.name}`)
          }
        },
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
    adminPlugin({
      ac,
      roles: {
        user,
        admin: adminRole
      },
      defaultRole: 'user'
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
