export const appointmentEmail = {
  id: 'appointment',
  labelKey: 'planning.appointments',
  defaults: {
    en: {
      subject: 'Appointment: {{product}}',
      body: '{{status}}<br>{{product}}<br>{{time}}<br><a href="{{meetingUrl}}">Meeting</a><br><a href="{{url}}">Manage your appointment</a>'
    },
    nl: {
      subject: 'Afspraak: {{product}}',
      body: '{{status}}<br>{{product}}<br>{{time}}<br><a href="{{meetingUrl}}">Deelnemen</a><br><a href="{{url}}">Beheer je afspraak</a>'
    }
  },
  placeholders: ['product', 'status', 'time', 'meetingUrl', 'url'].map((key) => ({
    key,
    labelKey: `planning.${key}`,
    example: key
  }))
}
