const appointmentPlaceholders = ['recipient_name', 'product', 'time', 'meetingUrl', 'url'].map((key) => ({
  key,
  labelKey: `planning.${key}`,
  example: key === 'recipient_name' ? 'Alex' : key
}))

const appointmentStatusPlaceholders = [
  ...appointmentPlaceholders,
  { key: 'status', labelKey: 'planning.status', example: 'Appointment confirmed' }
]

export const newAppointmentEmail = {
  id: 'appointment-new',
  labelKey: 'planning.emailNewAppointment',
  defaults: {
    en: {
      subject: 'Your appointment is confirmed: {{product}}',
      body: 'Dear {{recipient_name}},\n\nYour new appointment has been confirmed. You can find the details below.\n\n- **Appointment:** {{product}}\n- **Date and time:** {{time}}\n\n[Join the meeting]({{meetingUrl}})\n\nYou can review or manage your appointment at any time from [your appointments]({{url}}).',
      footer:
        'We look forward to seeing you. If anything changes, you can always find the most recent information through the appointment link above.'
    },
    nl: {
      subject: 'Je afspraak is bevestigd: {{product}}',
      body: 'Beste {{recipient_name}},\n\nJe nieuwe afspraak is bevestigd. Hieronder vind je de gegevens.\n\n- **Afspraak:** {{product}}\n- **Datum en tijd:** {{time}}\n\n[Deelnemen aan de afspraak]({{meetingUrl}})\n\nJe kunt je afspraak op elk moment bekijken of beheren via [je afspraken]({{url}}).',
      footer:
        'We kijken ernaar uit je te zien. Als er iets verandert, vind je via de bovenstaande link altijd de meest recente informatie.'
    }
  },
  placeholders: appointmentPlaceholders
}

export const updatedAppointmentEmail = {
  // Keep the original id so existing organization-specific customizations remain attached.
  id: 'appointment',
  labelKey: 'planning.emailUpdatedAppointment',
  defaults: {
    en: {
      subject: 'Your appointment has been updated: {{product}}',
      body: 'Dear {{recipient_name}},\n\nYour appointment has been updated. You can find the latest details below.\n\n**{{status}}**\n\n- **Appointment:** {{product}}\n- **Date and time:** {{time}}\n\n[Join the meeting]({{meetingUrl}})\n\nYou can review or manage your appointment at any time from [your appointments]({{url}}).',
      footer:
        'We look forward to seeing you. If anything changes, you can always find the most recent information through the appointment link above.'
    },
    nl: {
      subject: 'Je afspraak is bijgewerkt: {{product}}',
      body: 'Beste {{recipient_name}},\n\nJe afspraak is bijgewerkt. Hieronder vind je de meest recente gegevens.\n\n**{{status}}**\n\n- **Afspraak:** {{product}}\n- **Datum en tijd:** {{time}}\n\n[Deelnemen aan de afspraak]({{meetingUrl}})\n\nJe kunt je afspraak op elk moment bekijken of beheren via [je afspraken]({{url}}).',
      footer:
        'We kijken ernaar uit je te zien. Als er iets verandert, vind je via de bovenstaande link altijd de meest recente informatie.'
    }
  },
  placeholders: appointmentStatusPlaceholders
}

export const canceledAppointmentEmail = {
  id: 'appointment-canceled',
  labelKey: 'planning.emailCanceledAppointment',
  defaults: {
    en: {
      subject: 'Your appointment has been canceled: {{product}}',
      body: 'Dear {{recipient_name}},\n\nYour appointment has been canceled. The canceled appointment was scheduled as follows:\n\n- **Appointment:** {{product}}\n- **Date and time:** {{time}}\n\nYou can view your appointments or arrange another time from [your appointments]({{url}}).',
      footer: 'If you have any questions about this cancellation, please contact us and we will be happy to help.'
    },
    nl: {
      subject: 'Je afspraak is geannuleerd: {{product}}',
      body: 'Beste {{recipient_name}},\n\nJe afspraak is geannuleerd. De geannuleerde afspraak stond als volgt gepland:\n\n- **Afspraak:** {{product}}\n- **Datum en tijd:** {{time}}\n\nJe kunt je afspraken bekijken of een ander tijdstip regelen via [je afspraken]({{url}}).',
      footer: 'Heb je vragen over deze annulering? Neem dan gerust contact met ons op; we helpen je graag verder.'
    }
  },
  placeholders: appointmentPlaceholders
}

// Operational notifications still use the general appointment-update template.
export const appointmentEmail = updatedAppointmentEmail
