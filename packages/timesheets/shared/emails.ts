import type { PortalEmailDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

export const timesheetEmails: PortalEmailDefinition[] = [
  {
    id: 'internal-requested',
    labelKey: 'features.timesheets.email.messages.internal-requested',
    defaults: {
      en: {
        subject: 'Internal approval requested — {{person_name}} ({{period}})',
        body: 'Dear {{recipient_name}},\n\nA timesheet is ready for your internal review. Please check the submitted hours and details before deciding whether it can move to the next step.\n\n- **Organization:** {{organization_name}}\n- **Team member:** {{person_name}}\n- **Period:** {{period}}\n- **Client:** {{client_name}}\n- **Comment:** {{comment}}\n\n[Review the timesheet]({{action_url}})',
        footer: 'Thank you for taking the time to review this submission. Your prompt response helps keep the approval process moving smoothly.'
      },
      nl: {
        subject: 'Interne goedkeuring gevraagd — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nEr staat een urenstaat klaar voor uw interne beoordeling. Controleer de ingediende uren en gegevens voordat u beslist of deze door kan naar de volgende stap.\n\n- **Organisatie:** {{organization_name}}\n- **Medewerker:** {{person_name}}\n- **Periode:** {{period}}\n- **Klant:** {{client_name}}\n- **Opmerking:** {{comment}}\n\n[Urenstaat beoordelen]({{action_url}})',
        footer: 'Bedankt dat u de tijd neemt om deze urenstaat te beoordelen. Met een snelle reactie blijft het goedkeuringsproces soepel verlopen.'
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
        body: 'Dear {{recipient_name}},\n\nGood news: your timesheet has been approved internally and can now continue through the approval process.\n\n- **Organization:** {{organization_name}}\n- **Team member:** {{person_name}}\n- **Period:** {{period}}\n- **Client:** {{client_name}}\n- **Comment:** {{comment}}\n\n[View the approved timesheet]({{action_url}})',
        footer: 'No further action is needed from you right now. You can use the link above whenever you want to review the latest status.'
      },
      nl: {
        subject: 'Urenstaat intern goedgekeurd — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nGoed nieuws: uw urenstaat is intern goedgekeurd en kan nu verder in het goedkeuringsproces.\n\n- **Organisatie:** {{organization_name}}\n- **Medewerker:** {{person_name}}\n- **Periode:** {{period}}\n- **Klant:** {{client_name}}\n- **Opmerking:** {{comment}}\n\n[Goedgekeurde urenstaat bekijken]({{action_url}})',
        footer: 'U hoeft op dit moment niets te doen. Via de bovenstaande link kunt u altijd de meest recente status bekijken.'
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
        body: 'Dear {{recipient_name}},\n\nYour timesheet could not be approved internally yet. Please review the feedback below, update the submission where needed, and submit it again when it is ready.\n\n- **Organization:** {{organization_name}}\n- **Team member:** {{person_name}}\n- **Period:** {{period}}\n- **Client:** {{client_name}}\n- **Feedback:** {{comment}}\n\n[Review and update the timesheet]({{action_url}})',
        footer: 'If the feedback is unclear, please contact the person responsible for the internal review before resubmitting.'
      },
      nl: {
        subject: 'Urenstaat intern afgewezen — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nUw urenstaat kon intern nog niet worden goedgekeurd. Bekijk de feedback hieronder, pas de urenstaat waar nodig aan en dien deze opnieuw in zodra alles klopt.\n\n- **Organisatie:** {{organization_name}}\n- **Medewerker:** {{person_name}}\n- **Periode:** {{period}}\n- **Klant:** {{client_name}}\n- **Feedback:** {{comment}}\n\n[Urenstaat bekijken en aanpassen]({{action_url}})',
        footer: 'Is de feedback niet duidelijk? Neem dan contact op met de interne beoordelaar voordat u de urenstaat opnieuw indient.'
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
        body: 'Dear {{recipient_name}},\n\nYour timesheet has been reopened, so you can make changes again. Please review the reason below and update the relevant entries before resubmitting.\n\n- **Organization:** {{organization_name}}\n- **Team member:** {{person_name}}\n- **Period:** {{period}}\n- **Client:** {{client_name}}\n- **Comment:** {{comment}}\n\n[Open and edit the timesheet]({{action_url}})',
        footer: 'When your changes are complete, submit the timesheet again so the approval process can continue.'
      },
      nl: {
        subject: 'Urenstaat heropend — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nUw urenstaat is heropend, zodat u opnieuw wijzigingen kunt aanbrengen. Bekijk de reden hieronder en pas de betreffende registraties aan voordat u de urenstaat opnieuw indient.\n\n- **Organisatie:** {{organization_name}}\n- **Medewerker:** {{person_name}}\n- **Periode:** {{period}}\n- **Klant:** {{client_name}}\n- **Opmerking:** {{comment}}\n\n[Urenstaat openen en bewerken]({{action_url}})',
        footer: 'Dien de urenstaat opnieuw in zodra uw wijzigingen klaar zijn, zodat het goedkeuringsproces verder kan gaan.'
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
        body: 'Dear {{recipient_name}},\n\nA timesheet has completed its internal review and is now waiting for your organization’s approval. Please check the hours and supporting details below.\n\n- **Organization:** {{organization_name}}\n- **Team member:** {{person_name}}\n- **Period:** {{period}}\n- **Client:** {{client_name}}\n- **Comment:** {{comment}}\n\n[Review the timesheet]({{action_url}})',
        footer: 'You can approve the timesheet or raise a concern from the review page. Thank you for helping us complete the process.'
      },
      nl: {
        subject: 'Klantgoedkeuring gevraagd — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nEen urenstaat heeft de interne beoordeling doorlopen en wacht nu op goedkeuring door uw organisatie. Controleer de uren en aanvullende gegevens hieronder.\n\n- **Organisatie:** {{organization_name}}\n- **Medewerker:** {{person_name}}\n- **Periode:** {{period}}\n- **Klant:** {{client_name}}\n- **Opmerking:** {{comment}}\n\n[Urenstaat beoordelen]({{action_url}})',
        footer: 'Op de beoordelingspagina kunt u de urenstaat goedkeuren of een bezwaar aangeven. Bedankt dat u helpt het proces af te ronden.'
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
        body: 'Dear {{recipient_name}},\n\nGood news: the client has reviewed and approved the timesheet below. The approval process for this submission is now complete.\n\n- **Organization:** {{organization_name}}\n- **Team member:** {{person_name}}\n- **Period:** {{period}}\n- **Client:** {{client_name}}\n- **Comment:** {{comment}}\n\n[View the approved timesheet]({{action_url}})',
        footer: 'Thank you for keeping the timesheet accurate and complete. No further action is required for this submission.'
      },
      nl: {
        subject: 'Urenstaat goedgekeurd door klant — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nGoed nieuws: de klant heeft de onderstaande urenstaat beoordeeld en goedgekeurd. Het goedkeuringsproces voor deze inzending is daarmee afgerond.\n\n- **Organisatie:** {{organization_name}}\n- **Medewerker:** {{person_name}}\n- **Periode:** {{period}}\n- **Klant:** {{client_name}}\n- **Opmerking:** {{comment}}\n\n[Goedgekeurde urenstaat bekijken]({{action_url}})',
        footer: 'Bedankt voor het zorgvuldig en volledig bijhouden van de uren. Voor deze inzending hoeft u niets meer te doen.'
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
        body: 'Dear {{recipient_name}},\n\nThe client has raised a concern about the timesheet below. Please review their feedback and coordinate any necessary corrections before the timesheet is submitted again.\n\n- **Organization:** {{organization_name}}\n- **Team member:** {{person_name}}\n- **Period:** {{period}}\n- **Client:** {{client_name}}\n- **Client feedback:** {{comment}}\n\n[Review the disputed timesheet]({{action_url}})',
        footer: 'Please follow up with the client if clarification is needed. Resolving the concern promptly will help keep the approval process on track.'
      },
      nl: {
        subject: 'Urenstaat betwist door klant — {{person_name}} ({{period}})',
        body: 'Beste {{recipient_name}},\n\nDe klant heeft een bezwaar aangegeven bij de onderstaande urenstaat. Bekijk de feedback en stem eventuele correcties af voordat de urenstaat opnieuw wordt ingediend.\n\n- **Organisatie:** {{organization_name}}\n- **Medewerker:** {{person_name}}\n- **Periode:** {{period}}\n- **Klant:** {{client_name}}\n- **Feedback van de klant:** {{comment}}\n\n[Betwiste urenstaat bekijken]({{action_url}})',
        footer: 'Neem contact op met de klant als nadere uitleg nodig is. Door het bezwaar snel op te lossen, blijft het goedkeuringsproces op schema.'
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
