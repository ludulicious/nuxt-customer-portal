export const appointmentEmail = {
  id: 'appointment',
  labelKey: 'planning.appointments',
  defaults: {
    en: {
      subject: 'Appointment: {{product}}',
      body: '**{{status}}**\n\n{{product}}  \n{{time}}\n\n[Meeting]({{meetingUrl}}) · [Manage your appointment]({{url}})'
    },
    nl: {
      subject: 'Afspraak: {{product}}',
      body: '**{{status}}**\n\n{{product}}  \n{{time}}\n\n[Deelnemen]({{meetingUrl}}) · [Beheer je afspraak]({{url}})'
    }
  },
  placeholders: ['product', 'status', 'time', 'meetingUrl', 'url'].map((key) => ({
    key,
    labelKey: `planning.${key}`,
    example: key
  }))
}
