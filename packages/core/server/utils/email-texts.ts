/**
 * Centralized invitation email content
 * Used across all invitation email sending functions
 */

export interface InvitationEmailParams {
  inviterName: string
  inviterEmail: string
  organizationName: string
  role: string
  invitationLink: string
}

export function getInvitationEmailContent(params: InvitationEmailParams) {
  const { inviterName, inviterEmail, organizationName, role, invitationLink } = params
  const inviterDisplay = inviterName || inviterEmail

  return {
    messageId: 'invitation',
    values: {
      inviter_name: inviterDisplay,
      organization_name: organizationName,
      role: role || 'member',
      action_url: invitationLink
    },
    subject: `You've been invited to join ${organizationName}`,
    params: {
      greeting: 'Hello,',
      body_text: `${inviterDisplay} has invited you to join <strong>${organizationName}</strong> as a ${role || 'member'}. Click the button below to accept the invitation and create your account.
             <p style="text-align: center;">
                <a href="${invitationLink}" class="button">Accept Invitation</a>
            </p>
        `,
      action_url: invitationLink,
      action_text: 'Accept Invitation',
      footer_text: 'This invitation will expire soon. If you did not expect this invitation, please ignore this email.'
    }
  }
}

export interface PersonalAccountInvitationEmailParams {
  invitationLink: string
  recipientName?: string | null
}

export function getPersonalAccountInvitationEmailContent(params: PersonalAccountInvitationEmailParams) {
  return {
    messageId: 'personal-account-invitation',
    values: {
      ...(params.recipientName?.trim() ? { recipient_name: params.recipientName.trim() } : {}),
      action_url: params.invitationLink
    },
    subject: 'Set up your personal portal account',
    params: {
      greeting: 'Hello,',
      body_text: `A personal portal profile has been created for you. Set up your account to access your purchases, appointments, invoices, and shared files.
             <p style="text-align: center;">
                <a href="${params.invitationLink}" class="button">Set up your account</a>
            </p>
        `,
      action_url: params.invitationLink,
      action_text: 'Set up your account',
      footer_text: 'This account setup link expires soon. If you did not expect this message, please ignore it.'
    }
  }
}

/**
 * Centralized OTP email content
 * Used for email verification, sign-in, and password reset OTP codes
 */

export type OTPEmailType = 'email-verification' | 'sign-in' | 'forget-password' | 'change-email'

export interface OTPEmailParams {
  otp: string
  type: OTPEmailType
  brandName?: string
}

export function getOTPEmailContent(params: OTPEmailParams) {
  const { otp, type, brandName = 'Nuxt Customer Portal' } = params

  const subjects = {
    'email-verification': `Verify your ${brandName} email address`,
    'sign-in': `Your ${brandName} sign-in code`,
    'forget-password': `Reset your ${brandName} password`,
    'change-email': `Confirm your new ${brandName} email address`
  }

  return {
    messageId: type,
    values: { otp },
    subject: subjects[type],
    params: {
      greeting: 'Hello,',
      body_text: `Your verification code is: <code>${otp}</code>`,
      action_url: '#', // Not used for OTP
      action_text: 'Verification Code',
      footer_text: 'This code will expire soon. If you did not request this, please ignore this email.'
    }
  }
}

/**
 * Centralized account deletion email content
 * Used for account deletion verification
 */

export interface DeleteAccountEmailParams {
  userName: string
  userEmail: string
  deletionLink: string
}

export function getDeleteAccountEmailContent(params: DeleteAccountEmailParams) {
  const { userName, userEmail, deletionLink } = params
  const userDisplay = userName || userEmail

  return {
    messageId: 'account-deletion',
    values: { user_name: userDisplay, action_url: deletionLink },
    subject: 'Confirm Account Deletion',
    params: {
      greeting: `Hello ${userDisplay},`,
      body_text: `You have requested to delete your account. This action cannot be undone. All your data will be permanently deleted.
             <p style="text-align: center;">
                <a href="${deletionLink}" class="button">Delete Account</a>
            </p>
        `,
      action_url: deletionLink,
      action_text: 'Delete Account',
      footer_text:
        'If you did not request to delete your account, please ignore this email and your account will remain active.'
    }
  }
}
