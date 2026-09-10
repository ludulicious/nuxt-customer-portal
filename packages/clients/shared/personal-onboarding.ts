export const needsPersonalOnboarding = (input: {
  enabled: boolean
  emailVerified: boolean
  membershipCount: number
  hasPendingInvitation: boolean
}) => input.enabled && input.emailVerified && input.membershipCount === 0 && !input.hasPendingInvitation
