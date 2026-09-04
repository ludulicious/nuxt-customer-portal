import type { PortalEmailDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const timesheetEmails: PortalEmailDefinition[] = [
  {
    id: 'internal-requested',
    labelKey: 'features.timesheets.email.messages.internal-requested',
    defaults: {
      en: {
        subject: 'Internal approval requested — {{person_name}} ({{period}})',
        body: 'Please review the timesheet.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Open timesheets</a>'
      },
      nl: {
        subject: 'Interne goedkeuring gevraagd — {{person_name}} ({{period}})',
        body: 'Beoordeel de urenstaat.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Urenstaten openen</a>'
      }
    },
    placeholders: [
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
        body: 'Your timesheet has been approved internally.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Open timesheets</a>'
      },
      nl: {
        subject: 'Urenstaat intern goedgekeurd — {{person_name}} ({{period}})',
        body: 'Uw urenstaat is intern goedgekeurd.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Urenstaten openen</a>'
      }
    },
    placeholders: [
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
        body: 'Your timesheet has been rejected internally.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Open timesheets</a>'
      },
      nl: {
        subject: 'Urenstaat intern afgewezen — {{person_name}} ({{period}})',
        body: 'Uw urenstaat is intern afgewezen.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Urenstaten openen</a>'
      }
    },
    placeholders: [
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
        body: 'Your timesheet has been reopened for editing.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Open timesheets</a>'
      },
      nl: {
        subject: 'Urenstaat heropend — {{person_name}} ({{period}})',
        body: 'Uw urenstaat is heropend voor wijzigingen.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Urenstaten openen</a>'
      }
    },
    placeholders: [
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
        body: 'Please review the timesheet for your organization.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Open timesheets</a>'
      },
      nl: {
        subject: 'Klantgoedkeuring gevraagd — {{person_name}} ({{period}})',
        body: 'Beoordeel de urenstaat voor uw organisatie.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Urenstaten openen</a>'
      }
    },
    placeholders: [
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
        body: 'The client has approved your timesheet.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Open timesheets</a>'
      },
      nl: {
        subject: 'Urenstaat goedgekeurd door klant — {{person_name}} ({{period}})',
        body: 'De klant heeft uw urenstaat goedgekeurd.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Urenstaten openen</a>'
      }
    },
    placeholders: [
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
        body: 'The client has disputed your timesheet.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Open timesheets</a>'
      },
      nl: {
        subject: 'Urenstaat betwist door klant — {{person_name}} ({{period}})',
        body: 'De klant heeft uw urenstaat betwist.<br><br>{{organization_name}}<br>{{person_name}}: {{period}}<br>{{client_name}}<br>{{comment}}<br><br><a href="{{action_url}}" class="button">Urenstaten openen</a>'
      }
    },
    placeholders: [
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
