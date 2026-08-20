import { createAuthClient } from 'better-auth/vue' // Use the Vue-specific import
import { adminClient, emailOTPClient, organizationClient } from 'better-auth/client/plugins'
import { ac, user, admin as adminRole } from '@nuxt-customer-portal/core/shared/permissions'

const baseURL = import.meta.client ? window.location.origin : process.env.BETTER_AUTH_URL

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    adminClient({
      ac,
      roles: {
        user,
        admin: adminRole
      }
    }),
    emailOTPClient(),
    organizationClient() // Add organization client
  ],
})

export type AuthSession = typeof authClient.$Infer.Session.session
export type AuthUser = typeof authClient.$Infer.Session.user & { providerId?: string }
export type AuthSessionResponse = typeof authClient.$Infer.Session.session & { user: User }
export type AuthActiveOganization = typeof authClient.$Infer.ActiveOrganization
export type AuthMember = typeof authClient.$Infer.Member
export type AuthOrganization = typeof authClient.$Infer.Organization
export type AuthInvitation = typeof authClient.$Infer.Invitation
export type AuthTeam = typeof authClient.$Infer.Team

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  emailOtp,
  sendVerificationEmail,
} = authClient
