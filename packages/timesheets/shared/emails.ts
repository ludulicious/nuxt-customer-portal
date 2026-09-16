import type { PortalEmailDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const timesheetEmails: PortalEmailDefinition[] = [
  {
    id: 'internal-requested',
    labelKey: 'features.timesheets.email.messages.internal-requested',
    defaults: {
      en: {
        subject: 'Internal approval requested — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nPlease review the timesheet.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Open timesheets]({{action_url}})'
      },
      nl: {
        subject: 'Interne goedkeuring gevraagd — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nBeoordeel de urenstaat.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Urenstaten openen]({{action_url}})'
      }
    },
    placeholders: [
      {
        key: 'recipient_name',
        labelKey: 'features.timesheets.email.placeholders.recipient_name',
        example: 'Alex Example'
      },
      { key: 'period', labelKey: 'features.timesheets.email.placeholders.period', example: 'do 3 – vr 4 sep 2026' },
      {
        key: 'person_name',
        labelKey: 'features.timesheets.email.placeholders.person_name',
        example: 'Alex Example'
      },
      {
        key: 'organization_name',
        labelKey: 'features.timesheets.email.placeholders.organization_name',
        example: 'Example Company'
      },
      {
        key: 'period_start',
        labelKey: 'features.timesheets.email.placeholders.period_start',
        example: '2026-09-01'
      },
      {
        key: 'period_end',
        labelKey: 'features.timesheets.email.placeholders.period_end',
        example: '2026-09-03'
      },
      {
        key: 'client_name',
        labelKey: 'features.timesheets.email.placeholders.client_name',
        example: 'Example Client'
      },
      {
        key: 'comment',
        labelKey: 'features.timesheets.email.placeholders.comment',
        example: ''
      },
      {
        key: 'action_url',
        labelKey: 'features.timesheets.email.placeholders.action_url',
        example: 'https://portal.example.com/timesheets'
      }
    ]
  },
  {
    id: 'internal-approved',
    labelKey: 'features.timesheets.email.messages.internal-approved',
    defaults: {
      en: {
        subject: 'Timesheet approved internally — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nYour timesheet has been approved internally.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Open timesheets]({{action_url}})'
      },
      nl: {
        subject: 'Urenstaat intern goedgekeurd — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nUw urenstaat is intern goedgekeurd.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Urenstaten openen]({{action_url}})'
      }
    },
    placeholders: [
      {
        key: 'recipient_name',
        labelKey: 'features.timesheets.email.placeholders.recipient_name',
        example: 'Alex Example'
      },
      { key: 'period', labelKey: 'features.timesheets.email.placeholders.period', example: 'do 3 – vr 4 sep 2026' },
      {
        key: 'person_name',
        labelKey: 'features.timesheets.email.placeholders.person_name',
        example: 'Alex Example'
      },
      {
        key: 'organization_name',
        labelKey: 'features.timesheets.email.placeholders.organization_name',
        example: 'Example Company'
      },
      {
        key: 'period_start',
        labelKey: 'features.timesheets.email.placeholders.period_start',
        example: '2026-09-01'
      },
      {
        key: 'period_end',
        labelKey: 'features.timesheets.email.placeholders.period_end',
        example: '2026-09-03'
      },
      {
        key: 'client_name',
        labelKey: 'features.timesheets.email.placeholders.client_name',
        example: 'Example Client'
      },
      {
        key: 'comment',
        labelKey: 'features.timesheets.email.placeholders.comment',
        example: ''
      },
      {
        key: 'action_url',
        labelKey: 'features.timesheets.email.placeholders.action_url',
        example: 'https://portal.example.com/timesheets'
      }
    ]
  },
  {
    id: 'internal-rejected',
    labelKey: 'features.timesheets.email.messages.internal-rejected',
    defaults: {
      en: {
        subject: 'Timesheet rejected internally — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nYour timesheet has been rejected internally.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Open timesheets]({{action_url}})'
      },
      nl: {
        subject: 'Urenstaat intern afgewezen — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nUw urenstaat is intern afgewezen.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Urenstaten openen]({{action_url}})'
      }
    },
    placeholders: [
      {
        key: 'recipient_name',
        labelKey: 'features.timesheets.email.placeholders.recipient_name',
        example: 'Alex Example'
      },
      { key: 'period', labelKey: 'features.timesheets.email.placeholders.period', example: 'do 3 – vr 4 sep 2026' },
      {
        key: 'person_name',
        labelKey: 'features.timesheets.email.placeholders.person_name',
        example: 'Alex Example'
      },
      {
        key: 'organization_name',
        labelKey: 'features.timesheets.email.placeholders.organization_name',
        example: 'Example Company'
      },
      {
        key: 'period_start',
        labelKey: 'features.timesheets.email.placeholders.period_start',
        example: '2026-09-01'
      },
      {
        key: 'period_end',
        labelKey: 'features.timesheets.email.placeholders.period_end',
        example: '2026-09-03'
      },
      {
        key: 'client_name',
        labelKey: 'features.timesheets.email.placeholders.client_name',
        example: 'Example Client'
      },
      {
        key: 'comment',
        labelKey: 'features.timesheets.email.placeholders.comment',
        example: ''
      },
      {
        key: 'action_url',
        labelKey: 'features.timesheets.email.placeholders.action_url',
        example: 'https://portal.example.com/timesheets'
      }
    ]
  },
  {
    id: 'internal-reopened',
    labelKey: 'features.timesheets.email.messages.internal-reopened',
    defaults: {
      en: {
        subject: 'Timesheet reopened — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nYour timesheet has been reopened for editing.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Open timesheets]({{action_url}})'
      },
      nl: {
        subject: 'Urenstaat heropend — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nUw urenstaat is heropend voor wijzigingen.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Urenstaten openen]({{action_url}})'
      }
    },
    placeholders: [
      {
        key: 'recipient_name',
        labelKey: 'features.timesheets.email.placeholders.recipient_name',
        example: 'Alex Example'
      },
      { key: 'period', labelKey: 'features.timesheets.email.placeholders.period', example: 'do 3 – vr 4 sep 2026' },
      {
        key: 'person_name',
        labelKey: 'features.timesheets.email.placeholders.person_name',
        example: 'Alex Example'
      },
      {
        key: 'organization_name',
        labelKey: 'features.timesheets.email.placeholders.organization_name',
        example: 'Example Company'
      },
      {
        key: 'period_start',
        labelKey: 'features.timesheets.email.placeholders.period_start',
        example: '2026-09-01'
      },
      {
        key: 'period_end',
        labelKey: 'features.timesheets.email.placeholders.period_end',
        example: '2026-09-03'
      },
      {
        key: 'client_name',
        labelKey: 'features.timesheets.email.placeholders.client_name',
        example: 'Example Client'
      },
      {
        key: 'comment',
        labelKey: 'features.timesheets.email.placeholders.comment',
        example: ''
      },
      {
        key: 'action_url',
        labelKey: 'features.timesheets.email.placeholders.action_url',
        example: 'https://portal.example.com/timesheets'
      }
    ]
  },
  {
    id: 'client-requested',
    labelKey: 'features.timesheets.email.messages.client-requested',
    defaults: {
      en: {
        subject: 'Client approval requested — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nPlease review the timesheet for your organization.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Open timesheets]({{action_url}})'
      },
      nl: {
        subject: 'Klantgoedkeuring gevraagd — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nBeoordeel de urenstaat voor uw organisatie.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Urenstaten openen]({{action_url}})'
      }
    },
    placeholders: [
      {
        key: 'recipient_name',
        labelKey: 'features.timesheets.email.placeholders.recipient_name',
        example: 'Alex Example'
      },
      { key: 'period', labelKey: 'features.timesheets.email.placeholders.period', example: 'do 3 – vr 4 sep 2026' },
      {
        key: 'person_name',
        labelKey: 'features.timesheets.email.placeholders.person_name',
        example: 'Alex Example'
      },
      {
        key: 'organization_name',
        labelKey: 'features.timesheets.email.placeholders.organization_name',
        example: 'Example Company'
      },
      {
        key: 'period_start',
        labelKey: 'features.timesheets.email.placeholders.period_start',
        example: '2026-09-01'
      },
      {
        key: 'period_end',
        labelKey: 'features.timesheets.email.placeholders.period_end',
        example: '2026-09-03'
      },
      {
        key: 'client_name',
        labelKey: 'features.timesheets.email.placeholders.client_name',
        example: 'Example Client'
      },
      {
        key: 'comment',
        labelKey: 'features.timesheets.email.placeholders.comment',
        example: ''
      },
      {
        key: 'action_url',
        labelKey: 'features.timesheets.email.placeholders.action_url',
        example: 'https://portal.example.com/timesheets'
      }
    ]
  },
  {
    id: 'client-approved',
    labelKey: 'features.timesheets.email.messages.client-approved',
    defaults: {
      en: {
        subject: 'Timesheet approved by client — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nThe client has approved your timesheet.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Open timesheets]({{action_url}})'
      },
      nl: {
        subject: 'Urenstaat goedgekeurd door klant — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nDe klant heeft uw urenstaat goedgekeurd.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Urenstaten openen]({{action_url}})'
      }
    },
    placeholders: [
      {
        key: 'recipient_name',
        labelKey: 'features.timesheets.email.placeholders.recipient_name',
        example: 'Alex Example'
      },
      { key: 'period', labelKey: 'features.timesheets.email.placeholders.period', example: 'do 3 – vr 4 sep 2026' },
      {
        key: 'person_name',
        labelKey: 'features.timesheets.email.placeholders.person_name',
        example: 'Alex Example'
      },
      {
        key: 'organization_name',
        labelKey: 'features.timesheets.email.placeholders.organization_name',
        example: 'Example Company'
      },
      {
        key: 'period_start',
        labelKey: 'features.timesheets.email.placeholders.period_start',
        example: '2026-09-01'
      },
      {
        key: 'period_end',
        labelKey: 'features.timesheets.email.placeholders.period_end',
        example: '2026-09-03'
      },
      {
        key: 'client_name',
        labelKey: 'features.timesheets.email.placeholders.client_name',
        example: 'Example Client'
      },
      {
        key: 'comment',
        labelKey: 'features.timesheets.email.placeholders.comment',
        example: ''
      },
      {
        key: 'action_url',
        labelKey: 'features.timesheets.email.placeholders.action_url',
        example: 'https://portal.example.com/timesheets'
      }
    ]
  },
  {
    id: 'client-disputed',
    labelKey: 'features.timesheets.email.messages.client-disputed',
    defaults: {
      en: {
        subject: 'Timesheet disputed by client — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nThe client has disputed your timesheet.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Open timesheets]({{action_url}})'
      },
      nl: {
        subject: 'Urenstaat betwist door klant — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nDe klant heeft uw urenstaat betwist.\n\n**{{organization_name}}**  \n{{person_name}}: {{period}}  \n{{client_name}}  \n{{comment}}\n\n[Urenstaten openen]({{action_url}})'
      }
    },
    placeholders: [
      {
        key: 'recipient_name',
        labelKey: 'features.timesheets.email.placeholders.recipient_name',
        example: 'Alex Example'
      },
      { key: 'period', labelKey: 'features.timesheets.email.placeholders.period', example: 'do 3 – vr 4 sep 2026' },
      {
        key: 'person_name',
        labelKey: 'features.timesheets.email.placeholders.person_name',
        example: 'Alex Example'
      },
      {
        key: 'organization_name',
        labelKey: 'features.timesheets.email.placeholders.organization_name',
        example: 'Example Company'
      },
      {
        key: 'period_start',
        labelKey: 'features.timesheets.email.placeholders.period_start',
        example: '2026-09-01'
      },
      {
        key: 'period_end',
        labelKey: 'features.timesheets.email.placeholders.period_end',
        example: '2026-09-03'
      },
      {
        key: 'client_name',
        labelKey: 'features.timesheets.email.placeholders.client_name',
        example: 'Example Client'
      },
      {
        key: 'comment',
        labelKey: 'features.timesheets.email.placeholders.comment',
        example: ''
      },
      {
        key: 'action_url',
        labelKey: 'features.timesheets.email.placeholders.action_url',
        example: 'https://portal.example.com/timesheets'
      }
    ]
  }
]
