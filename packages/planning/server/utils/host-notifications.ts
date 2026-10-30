import { sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailRecipientName } from '@nuxt-customer-portal/core/shared/email-recipient'
import { baseUrl, getStore } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { developmentSandboxEffectsEnabled } from '@nuxt-customer-portal/products/server/utils/development'
import type { Order } from '@nuxt-customer-portal/products/shared/types'
import { hostAppointmentEmail } from '../../shared/emails'
import type { Appointment } from '../../shared/types'

export async function notifyAppointmentHost(appointment: Appointment, order: Order) {
  if (
    appointment.snapshot.hostNotificationRevision === appointment.revision ||
    (order.snapshot.storeMode === 'sandbox' && !developmentSandboxEffectsEnabled())
  ) {
    return
  }
  const [host] = await rows<{ email: string; first_name: string | null; name: string | null }>(
    `SELECT u.email,u.first_name,u.name FROM public."user" u
     JOIN public.member m ON m.user_id=u.id WHERE u.id=$1 AND m.organization_id=$2`,
    [appointment.user_id, appointment.store_id]
  )
  if (!host) {
    throw new Error('Appointment host is no longer a store member')
  }
  const store = await getStore()
  const locale = store.default_locale
  const status =
    appointment.status === 'cancelled'
      ? locale === 'nl'
        ? 'Afspraak geannuleerd'
        : 'Appointment canceled'
      : appointment.revision === 1
        ? locale === 'nl'
          ? 'Nieuwe afspraak geboekt'
          : 'New appointment booked'
        : locale === 'nl'
          ? 'Afspraak bijgewerkt'
          : 'Appointment updated'
  await sendPortalEmail({
    moduleId: 'planning',
    definition: hostAppointmentEmail,
    locale,
    to: host.email,
    values: {
      recipient_name: emailRecipientName({ firstName: host.first_name, displayName: host.name, email: host.email }),
      customer_name:
        order.snapshot.billing.name ||
        [order.snapshot.billing.firstName, order.snapshot.billing.lastName].filter(Boolean).join(' ') ||
        order.email,
      customer_email: order.email,
      product: appointment.snapshot.title,
      status,
      time: new Intl.DateTimeFormat(locale, {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: appointment.snapshot.timezone
      }).format(appointment.start_at),
      timezone: appointment.snapshot.timezone,
      bookingReference: order.booking_reference,
      meetingDetails:
        appointment.status !== 'cancelled' && appointment.meeting_url
          ? `[${locale === 'nl' ? 'Deelnemen aan de afspraak' : 'Join the meeting'}](${appointment.meeting_url})`
          : '',
      meetingUrl: appointment.status !== 'cancelled' ? appointment.meeting_url || '' : '',
      instructions: '',
      url: `${baseUrl()}/appointments`
    },
    idempotencyKey: `appointment-host:${appointment.id}:${appointment.revision}:${appointment.user_id}`,
    subjectPrefix: order.snapshot.storeMode === 'sandbox' ? '[TEST] ' : undefined
  })
  await rows(
    `UPDATE planning.appointment SET snapshot=jsonb_set(snapshot,'{hostNotificationRevision}',to_jsonb($2::int)) WHERE id=$1 AND revision=$2`,
    [appointment.id, appointment.revision]
  )
  appointment.snapshot.hostNotificationRevision = appointment.revision
}
