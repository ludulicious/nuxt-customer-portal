import type { PortalFeatureDefinition } from './types/feature'

export const coreFeature: PortalFeatureDefinition = {
  id: 'portal-core',
  navigation: [
    {
      id: 'dashboard',
      labelKey: 'menu.dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard',
      audiences: ['authenticated'],
      order: 10
    }
  ],
  modules: [
    {
      id: 'dashboard',
      labelKey: 'menu.dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard',
      routePrefixes: ['/dashboard'],
      audiences: ['authenticated'],
      order: 10,
      menuItems: [
        {
          id: 'dashboard',
          labelKey: 'menu.dashboard',
          icon: 'i-lucide-layout-dashboard',
          to: '/dashboard',
          audiences: ['authenticated']
        }
      ]
    }
  ],
  emails: [
    {
      id: 'email-verification',
      labelKey: 'admin.email.messages.emailVerification',
      defaults: {
        en: {
          subject: 'Verify your {{brand_name}} email address',
          body: 'Your verification code is: <code>{{otp}}</code>',
          footer: 'This code will expire soon. If you did not request this, please ignore this email.'
        },
        nl: {
          subject: 'Verifieer uw e-mailadres voor {{brand_name}}',
          body: 'Uw verificatiecode is: <code>{{otp}}</code>',
          footer: 'Deze code verloopt binnenkort. Negeer dit bericht als u dit niet heeft aangevraagd.'
        }
      },
      placeholders: [{ key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }]
    },
    {
      id: 'sign-in',
      labelKey: 'admin.email.messages.signIn',
      defaults: {
        en: {
          subject: 'Your {{brand_name}} sign-in code',
          body: 'Your sign-in code is: <code>{{otp}}</code>',
          footer: 'This code will expire soon. If you did not request this, please ignore this email.'
        },
        nl: {
          subject: 'Uw inlogcode voor {{brand_name}}',
          body: 'Uw inlogcode is: <code>{{otp}}</code>',
          footer: 'Deze code verloopt binnenkort. Negeer dit bericht als u dit niet heeft aangevraagd.'
        }
      },
      placeholders: [{ key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }]
    },
    {
      id: 'forget-password',
      labelKey: 'admin.email.messages.passwordReset',
      defaults: {
        en: {
          subject: 'Reset your {{brand_name}} password',
          body: 'Your password reset code is: <code>{{otp}}</code>',
          footer: 'This code will expire soon. If you did not request this, please ignore this email.'
        },
        nl: {
          subject: 'Stel uw wachtwoord voor {{brand_name}} opnieuw in',
          body: 'Uw code voor het opnieuw instellen van uw wachtwoord is: <code>{{otp}}</code>',
          footer: 'Deze code verloopt binnenkort. Negeer dit bericht als u dit niet heeft aangevraagd.'
        }
      },
      placeholders: [{ key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }]
    },
    {
      id: 'change-email',
      labelKey: 'admin.email.messages.changeEmail',
      defaults: {
        en: {
          subject: 'Confirm your new {{brand_name}} email address',
          body: 'Your confirmation code is: <code>{{otp}}</code>',
          footer: 'This code will expire soon. If you did not request this, please ignore this email.'
        },
        nl: {
          subject: 'Bevestig uw nieuwe e-mailadres voor {{brand_name}}',
          body: 'Uw bevestigingscode is: <code>{{otp}}</code>',
          footer: 'Deze code verloopt binnenkort. Negeer dit bericht als u dit niet heeft aangevraagd.'
        }
      },
      placeholders: [{ key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }]
    },
    {
      id: 'invitation',
      labelKey: 'admin.email.messages.invitation',
      defaults: {
        en: {
          subject: "You've been invited to join {{organization_name}}",
          body: '{{inviter_name}} has invited you to join <strong>{{organization_name}}</strong> as {{role}}.<p style="text-align:center"><a href="{{action_url}}" class="button">Accept invitation</a></p>',
          footer: 'This invitation will expire soon. If you did not expect it, please ignore this email.'
        },
        nl: {
          subject: 'U bent uitgenodigd voor {{organization_name}}',
          body: '{{inviter_name}} heeft u uitgenodigd om als {{role}} lid te worden van <strong>{{organization_name}}</strong>.<p style="text-align:center"><a href="{{action_url}}" class="button">Uitnodiging accepteren</a></p>',
          footer: 'Deze uitnodiging verloopt binnenkort. Negeer dit bericht als u dit niet verwachtte.'
        }
      },
      placeholders: [
        { key: 'inviter_name', labelKey: 'admin.email.placeholders.inviterName', example: 'Alex Morgan' },
        { key: 'organization_name', labelKey: 'admin.email.placeholders.organizationName', example: 'Example Company' },
        { key: 'role', labelKey: 'admin.email.placeholders.role', example: 'member' },
        { key: 'action_url', labelKey: 'admin.email.placeholders.actionUrl', example: 'https://example.com/signup' }
      ]
    },
    {
      id: 'account-deletion',
      labelKey: 'admin.email.messages.accountDeletion',
      defaults: {
        en: {
          subject: 'Confirm account deletion',
          body: 'Hello {{user_name}}, you requested to delete your account.<p style="text-align:center"><a href="{{action_url}}" class="button">Delete account</a></p>',
          footer: 'If you did not request this, ignore this email and your account will remain active.'
        },
        nl: {
          subject: 'Bevestig het verwijderen van uw account',
          body: 'Hallo {{user_name}}, u heeft gevraagd uw account te verwijderen.<p style="text-align:center"><a href="{{action_url}}" class="button">Account verwijderen</a></p>',
          footer: 'Negeer dit bericht als u dit niet heeft aangevraagd; uw account blijft dan actief.'
        }
      },
      placeholders: [
        { key: 'user_name', labelKey: 'admin.email.placeholders.userName', example: 'Alex Morgan' },
        {
          key: 'action_url',
          labelKey: 'admin.email.placeholders.actionUrl',
          example: 'https://example.com/delete-account'
        }
      ]
    }
  ],
  policy: { owner: [], admin: [], member: [] }
}
