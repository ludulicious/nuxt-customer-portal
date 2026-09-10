import { and, eq, gt, sql } from 'drizzle-orm'
import { requireSession, db } from '@nuxt-customer-portal/core/server/portal'
import { user, member, invitation } from '@nuxt-customer-portal/core/schema'
import { getClientConfiguration } from '../utils/client-configuration'
import { needsPersonalOnboarding } from '../../shared/personal-onboarding'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const config = getClientConfiguration()
  if (!config.personalSelfRegistration) {
    return { onboardingRequired: false }
  }
  const [account] = await db
    .select({ email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!account) {
    throw createError({ statusCode: 401 })
  }
  const [memberships, invitations] = await Promise.all([
    db.select({ id: member.id }).from(member).where(eq(member.userId, session.user.id)).limit(1),
    db
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          sql`lower(${invitation.email}) = lower(${account.email})`,
          eq(invitation.status, 'pending'),
          gt(invitation.expiresAt, new Date())
        )
      )
      .limit(1)
  ])
  return {
    onboardingRequired: needsPersonalOnboarding({
      enabled: true,
      emailVerified: account.emailVerified,
      membershipCount: memberships.length,
      hasPendingInvitation: invitations.length > 0
    })
  }
})
