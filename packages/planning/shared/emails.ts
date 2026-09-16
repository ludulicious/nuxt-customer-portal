export const appointmentEmail = {
  id: 'appointment',
  labelKey: 'planning.appointments',
  defaults: {
    en: {
      subject: 'Appointment: {{product}}',
      body: 'Dear {{recipient_name}},\n\nYour appointment has been updated. You can find the latest details below.\n\n**{{status}}**\n\n- **Appointment:** {{product}}\n- **Date and time:** {{time}}\n\n[Join the meeting]({{meetingUrl}})\n\nYou can review or manage your appointment at any time from [your appointments]({{url}}).',
      footer: 'We look forward to seeing you. If anything changes, you can always find the most recent information through the appointment link above.'
    },
    nl: {
      subject: 'Afspraak: {{product}}',
      body: 'Beste {{recipient_name}},\n\nJe afspraak is bijgewerkt. Hieronder vind je de meest recente gegevens.\n\n**{{status}}**\n\n- **Afspraak:** {{product}}\n- **Datum en tijd:** {{time}}\n\n[Deelnemen aan de afspraak]({{meetingUrl}})\n\nJe kunt je afspraak op elk moment bekijken of beheren via [je afspraken]({{url}}).',
      footer: 'We kijken ernaar uit je te zien. Als er iets verandert, vind je via de bovenstaande link altijd de meest recente informatie.'
    }
  },
  placeholders: ['recipient_name', 'product', 'status', 'time', 'meetingUrl', 'url'].map((key) => ({
    key,
    labelKey: `planning.${key}`,
    example: key === 'recipient_name' ? 'Alex' : key
  }))
}
