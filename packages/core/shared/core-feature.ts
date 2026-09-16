import type { PortalFeatureDefinition } from './types/feature'

const recipientNamePlaceholder = {
  key: 'recipient_name',
  labelKey: 'admin.email.placeholders.recipientName',
  example: 'Alex'
}

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
          body: 'Dear {{recipient_name}},\n\nWelcome to **{{brand_name}}**. To finish verifying your email address, enter the following code:\n\n`{{otp}}`\n\nOnce your email address is verified, you can continue setting up and using your account.',
          footer:
            'For your security, this code will expire soon and can only be used once. If you did not create or verify an account, you can safely ignore this email.'
        },
        nl: {
          subject: 'Verifieer uw e-mailadres voor {{brand_name}}',
          body: 'Beste {{recipient_name}},\n\nWelkom bij **{{brand_name}}**. Voer de volgende code in om de verificatie van uw e-mailadres af te ronden:\n\n`{{otp}}`\n\nNa de verificatie kunt u doorgaan met het instellen en gebruiken van uw account.',
          footer:
            'Voor uw veiligheid verloopt deze code binnenkort en kan deze maar één keer worden gebruikt. Heeft u geen account aangemaakt of geverifieerd? Dan kunt u deze e-mail veilig negeren.'
        }
      },
      placeholders: [
        recipientNamePlaceholder,
        { key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }
      ]
    },
    {
      id: 'sign-in',
      labelKey: 'admin.email.messages.signIn',
      defaults: {
        en: {
          subject: 'Your {{brand_name}} sign-in code',
          body: 'Dear {{recipient_name}},\n\nWe received a request to sign in to your **{{brand_name}}** account. Use the code below to continue:\n\n`{{otp}}`\n\nReturn to the sign-in screen and enter this code to securely access your account.',
          footer:
            'This code will expire soon and can only be used once. If you did not try to sign in, you can ignore this email; no changes will be made to your account.'
        },
        nl: {
          subject: 'Uw inlogcode voor {{brand_name}}',
          body: 'Beste {{recipient_name}},\n\nWe hebben een verzoek ontvangen om in te loggen op uw **{{brand_name}}**-account. Gebruik de onderstaande code om verder te gaan:\n\n`{{otp}}`\n\nGa terug naar het inlogscherm en voer deze code in om veilig toegang te krijgen tot uw account.',
          footer:
            'Deze code verloopt binnenkort en kan maar één keer worden gebruikt. Heeft u niet geprobeerd in te loggen? Dan kunt u deze e-mail negeren; er wordt niets aan uw account gewijzigd.'
        }
      },
      placeholders: [
        recipientNamePlaceholder,
        { key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }
      ]
    },
    {
      id: 'forget-password',
      labelKey: 'admin.email.messages.passwordReset',
      defaults: {
        en: {
          subject: 'Reset your {{brand_name}} password',
          body: 'Dear {{recipient_name}},\n\nWe received a request to reset the password for your **{{brand_name}}** account. Enter the following code on the password reset screen:\n\n`{{otp}}`\n\nAfter verification, you will be able to choose a new password.',
          footer:
            'For your security, this code will expire soon and can only be used once. If you did not request a password reset, ignore this email and your current password will remain unchanged.'
        },
        nl: {
          subject: 'Stel uw wachtwoord voor {{brand_name}} opnieuw in',
          body: 'Beste {{recipient_name}},\n\nWe hebben een verzoek ontvangen om het wachtwoord van uw **{{brand_name}}**-account opnieuw in te stellen. Voer de volgende code in op het scherm voor wachtwoordherstel:\n\n`{{otp}}`\n\nNa de verificatie kunt u een nieuw wachtwoord kiezen.',
          footer:
            'Voor uw veiligheid verloopt deze code binnenkort en kan deze maar één keer worden gebruikt. Heeft u geen wachtwoordherstel aangevraagd? Negeer dan deze e-mail; uw huidige wachtwoord blijft ongewijzigd.'
        }
      },
      placeholders: [
        recipientNamePlaceholder,
        { key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }
      ]
    },
    {
      id: 'change-email',
      labelKey: 'admin.email.messages.changeEmail',
      defaults: {
        en: {
          subject: 'Confirm your new {{brand_name}} email address',
          body: 'Dear {{recipient_name}},\n\nYou are changing the email address connected to your **{{brand_name}}** account. Enter the following code to confirm that this new address belongs to you:\n\n`{{otp}}`\n\nAfter confirmation, future account messages will be sent to this address.',
          footer:
            'This code will expire soon and can only be used once. If you did not request this change, ignore this email and review your account security.'
        },
        nl: {
          subject: 'Bevestig uw nieuwe e-mailadres voor {{brand_name}}',
          body: 'Beste {{recipient_name}},\n\nU wijzigt het e-mailadres dat aan uw **{{brand_name}}**-account is gekoppeld. Voer de volgende code in om te bevestigen dat dit nieuwe adres van u is:\n\n`{{otp}}`\n\nNa de bevestiging worden toekomstige accountberichten naar dit adres verzonden.',
          footer:
            'Deze code verloopt binnenkort en kan maar één keer worden gebruikt. Heeft u deze wijziging niet aangevraagd? Negeer dan deze e-mail en controleer de beveiliging van uw account.'
        }
      },
      placeholders: [
        recipientNamePlaceholder,
        { key: 'otp', labelKey: 'admin.email.placeholders.otp', example: '123456' }
      ]
    },
    {
      id: 'invitation',
      labelKey: 'admin.email.messages.invitation',
      defaults: {
        en: {
          subject: "You've been invited to join {{organization_name}}",
          body: 'Dear {{recipient_name}},\n\n**{{inviter_name}}** has invited you to join **{{organization_name}}** as **{{role}}**. By accepting, you will gain access to the organization and the features available for your role.\n\n[Review and accept the invitation]({{action_url}})\n\nWe look forward to welcoming you.',
          footer:
            'This personal invitation will expire soon. If you were not expecting it, you can safely ignore this email.'
        },
        nl: {
          subject: 'U bent uitgenodigd voor {{organization_name}}',
          body: 'Beste {{recipient_name}},\n\n**{{inviter_name}}** heeft u uitgenodigd om als **{{role}}** lid te worden van **{{organization_name}}**. Na acceptatie krijgt u toegang tot de organisatie en de functies die bij uw rol horen.\n\n[Uitnodiging bekijken en accepteren]({{action_url}})\n\nWe heten u graag welkom.',
          footer:
            'Deze persoonlijke uitnodiging verloopt binnenkort. Verwachtte u deze uitnodiging niet? Dan kunt u deze e-mail veilig negeren.'
        }
      },
      placeholders: [
        recipientNamePlaceholder,
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
          body: 'Dear {{recipient_name}},\n\nWe received a request to permanently delete your account. Because this action cannot be undone, please confirm that you want to continue.\n\n[Confirm account deletion]({{action_url}})\n\nYour account will remain active until you complete this confirmation.',
          footer:
            'If you did not request account deletion, do not use the link. You can safely ignore this email and your account will remain active.'
        },
        nl: {
          subject: 'Bevestig het verwijderen van uw account',
          body: 'Beste {{recipient_name}},\n\nWe hebben een verzoek ontvangen om uw account definitief te verwijderen. Omdat dit niet ongedaan kan worden gemaakt, vragen we u te bevestigen dat u wilt doorgaan.\n\n[Verwijderen van account bevestigen]({{action_url}})\n\nUw account blijft actief totdat u deze bevestiging heeft voltooid.',
          footer:
            'Heeft u niet gevraagd om uw account te verwijderen? Gebruik de link dan niet. U kunt deze e-mail veilig negeren; uw account blijft actief.'
        }
      },
      placeholders: [
        recipientNamePlaceholder,
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
