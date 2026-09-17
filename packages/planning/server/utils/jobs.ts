import { randomUUID } from 'node:crypto'
import { pool } from '@nuxt-customer-portal/core/server/utils/db'
import { sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailRecipientName } from '@nuxt-customer-portal/core/shared/email-recipient'
import { rows, transaction } from '@nuxt-customer-portal/products/server/utils/database'
import {
  getOrder,
  reconcileCheckout,
  processOrder,
  notifyOrder
} from '@nuxt-customer-portal/products/server/utils/orders'
import { stripeProvider } from '@nuxt-customer-portal/products/server/utils/payments'
import { baseUrl } from '@nuxt-customer-portal/products/server/utils/access'
import { developmentSandboxEffectsEnabled } from '@nuxt-customer-portal/products/server/utils/development'
import type { Appointment, AvailabilityWindow, Reservation } from '../../shared/types'
import { calendarInvitation } from '../../shared/invitation'
import { calendarWallDateTime, wallInstant } from '../../shared/availability'
import { appointmentCalendarDescription, appointmentCalendarTitle } from '../../shared/appointment-calendar'
import { calendarAdapter, meetingAdapter, externalBusy } from './adapters'
import { digest, secret } from './crypto'
import { enqueue, lockProvider } from './booking'

import {
  appointmentEmail,
  canceledAppointmentEmail,
  newAppointmentEmail,
  updatedAppointmentEmail,
  zoomLinkReadyEmail
} from '../../shared/emails'

export async function auditLock(tx: Pick<import('pg').PoolClient, 'query'>, id: string) {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`planning-effects:${id}`])
}
async function appointmentEffects(
  id: string,
  revision: number,
  notify = true,
  notificationKey?: string,
  ensureMeeting = true
) {
  const [a] = await rows<Appointment>('SELECT * FROM planning.appointment WHERE id=$1', [id])
  if (!a || a.revision !== revision) {
    return
  }
  const order = await getOrder(a.order_id)
  if (!order) {
    throw new Error('Appointment order missing')
  }
  // Repair invoice delivery for older paid appointments whose invoice was
  // created before invoice email jobs were scheduled transactionally.
  await notifyOrder(order.id)
  if (order.snapshot.storeMode === 'sandbox' && !developmentSandboxEffectsEnabled()) {
    return
  }
  const [provider] = await rows<{ write_calendar_id: string; email: string }>(
    `SELECT p.write_calendar_id,u.email FROM planning.provider p JOIN public."user" u ON u.id=p.user_id WHERE p.store_id=$1 AND p.user_id=$2`,
    [a.store_id, a.user_id]
  )
  const eventId = a.calendar_event_id || `p${id.replace(/-/g, '')}`
  let effectsFailure: unknown
  try {
    if (a.status === 'cancelled') {
      if (a.calendar_event_id && a.calendar_id) {
        await calendarAdapter().remove(a.store_id, a.calendar_user_id || a.user_id, a.calendar_id, a.calendar_event_id)
      }
      if (a.meeting_id) {
        await meetingAdapter().remove(a.store_id, a.user_id, a.meeting_id)
      }
    } else {
      if (a.snapshot.meetingProvider === 'zoom' && (ensureMeeting || !a.meeting_id || !a.meeting_url)) {
        const meeting = await meetingAdapter().ensure(
          a.store_id,
          a.user_id,
          `portal:${id}`,
          appointmentCalendarTitle(a.snapshot.title, order.snapshot.billing),
          a.start_at,
          a.snapshot.durationMinutes,
          {
            agenda: appointmentCalendarDescription({
              start: a.start_at,
              end: a.end_at,
              providerTimezone: a.snapshot.timezone,
              customerTimezone: a.snapshot.customerTimezone,
              locale: a.snapshot.locale,
              billing: order.snapshot.billing,
              email: order.email,
              graceMinutes: a.snapshot.graceMinutes
            }),
            inviteeEmail: order.email
          },
          a.meeting_id || undefined
        )
        a.meeting_id = meeting.id
        a.meeting_url = meeting.url
        await rows('UPDATE planning.appointment SET meeting_id=$2,meeting_url=$3 WHERE id=$1', [
          id,
          meeting.id,
          meeting.url
        ])
      }
      if (!provider?.write_calendar_id) {
        throw new Error('Select a writable calendar')
      }
      if (a.calendar_id && a.calendar_id !== provider.write_calendar_id && a.calendar_event_id) {
        await calendarAdapter().remove(a.store_id, a.calendar_user_id || a.user_id, a.calendar_id, a.calendar_event_id)
      }
      const written = await calendarAdapter().put(a.store_id, a.user_id, provider.write_calendar_id, {
        id: eventId,
        summary: appointmentCalendarTitle(a.snapshot.title, order.snapshot.billing),
        start: { dateTime: a.start_at.toISOString(), timeZone: a.snapshot.timezone },
        end: { dateTime: a.end_at.toISOString(), timeZone: a.snapshot.timezone },
        transparency: 'opaque',
        description: appointmentCalendarDescription({
          start: a.start_at,
          end: a.end_at,
          providerTimezone: a.snapshot.timezone,
          customerTimezone: a.snapshot.customerTimezone,
          locale: a.snapshot.locale,
          billing: order.snapshot.billing,
          email: order.email,
          meetingUrl: a.meeting_url,
          graceMinutes: a.snapshot.graceMinutes
        }),
        extendedProperties: { private: { portalPlanning: id, portalRevision: String(revision) } }
      })
      if (
        written?.externalChangeKey ||
        (written?.wasMissing && a.calendar_event_id && a.calendar_id === provider.write_calendar_id)
      ) {
        await enqueue(
          pool,
          `mirror-notice:${id}:${revision}:${written.externalChangeKey || 'missing'}`,
          'mirror-notice',
          { userId: a.user_id }
        )
      }
      await rows(
        'UPDATE planning.appointment SET calendar_event_id=$2,calendar_id=$3,calendar_user_id=user_id WHERE id=$1',
        [id, written?.id || eventId, provider.write_calendar_id]
      )
    }
  } catch (error) {
    effectsFailure = error
  }
  if (!notify) {
    if (effectsFailure) {
      throw effectsFailure
    }
    return
  }
  const locale = a.snapshot.locale
  const appointmentUrl = order.invitation_id
    ? `${baseUrl()}/signup?invitationId=${encodeURIComponent(order.invitation_id)}`
    : `${baseUrl()}/appointments`
  const meetingDetails = a.meeting_url
    ? locale === 'nl'
      ? `**Duur:** ${a.snapshot.durationMinutes} minuten\n\n[Deelnemen aan de afspraak](${a.meeting_url})`
      : `**Duration:** ${a.snapshot.durationMinutes} minutes\n\n[Join the meeting](${a.meeting_url})`
    : locale === 'nl'
      ? `**Duur:** ${a.snapshot.durationMinutes} minuten\n\nDe vergaderlink wordt later toegevoegd. Je vindt de actuele link altijd bij je afspraken.`
      : `**Duration:** ${a.snapshot.durationMinutes} minutes\n\nThe meeting link will be added later. You can always find the current link under your appointments.`
  const emailValues = {
    recipient_name: emailRecipientName({
      firstName: order.snapshot.billing.firstName,
      displayName: order.snapshot.billing.name,
      email: order.email
    }),
    product: a.snapshot.title,
    status:
      a.status === 'cancelled'
        ? locale === 'nl'
          ? 'Afspraak geannuleerd'
          : 'Appointment cancelled'
        : locale === 'nl'
          ? 'Afspraak bevestigd'
          : 'Appointment confirmed',
    time: new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: a.snapshot.customerTimezone
    }).format(a.start_at),
    timezone: a.snapshot.customerTimezone,
    meetingUrl: a.meeting_url || appointmentUrl,
    meetingDetails,
    instructions: order.lines[0]!.snapshot.product.nextSteps[locale] || '',
    url: appointmentUrl
  }
  const invitation = calendarInvitation({
    id,
    revision,
    title: a.snapshot.title,
    start: a.start_at,
    end: a.end_at,
    organizer: a.snapshot.organizerEmail || provider?.email || '',
    attendee: order.email,
    url: a.meeting_url,
    cancelled: a.status === 'cancelled'
  })
  if (notificationKey || a.snapshot.customerNotificationRevision !== revision) {
    try {
      // Stable organizer, attendee and UID prevent duplicate customer appointments.
      await sendPortalEmail({
        moduleId: 'planning',
        definition:
          a.status === 'cancelled'
            ? canceledAppointmentEmail
            : revision === 1
              ? newAppointmentEmail
              : updatedAppointmentEmail,
        locale,
        to: order.email,
        values: emailValues,
        attachments: [
          {
            filename: 'appointment.ics',
            content: Buffer.from(invitation),
            contentType: `text/calendar; method=${a.status === 'cancelled' ? 'CANCEL' : 'REQUEST'}; charset=UTF-8`
          }
        ],
        idempotencyKey: notificationKey || `appointment:${id}:${revision}`,
        subjectPrefix: order.snapshot.storeMode === 'sandbox' ? '[TEST] ' : undefined
      })
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      if (!message.includes('idempotency key has been used') || !message.includes('request body was modified')) {
        throw error
      }
    }
    a.snapshot.customerNotificationRevision = revision
    await rows(
      `UPDATE planning.appointment
       SET snapshot=jsonb_set(snapshot,'{customerNotificationRevision}',to_jsonb($2::int))
       WHERE id=$1`,
      [id, revision]
    )
  }
  if (a.status === 'confirmed' && a.snapshot.meetingProvider === 'zoom') {
    if (!a.meeting_url) {
      a.snapshot.zoomLinkNotificationPending = true
      await rows(
        `UPDATE planning.appointment
         SET snapshot=jsonb_set(snapshot,'{zoomLinkNotificationPending}','true'::jsonb)
         WHERE id=$1`,
        [id]
      )
    } else if (a.snapshot.zoomLinkNotificationPending) {
      await sendPortalEmail({
        moduleId: 'planning',
        definition: zoomLinkReadyEmail,
        locale,
        to: order.email,
        values: emailValues,
        idempotencyKey: `appointment-zoom-ready:${id}:${revision}`,
        subjectPrefix: order.snapshot.storeMode === 'sandbox' ? '[TEST] ' : undefined
      })
      await rows("UPDATE planning.appointment SET snapshot=snapshot-'zoomLinkNotificationPending' WHERE id=$1", [id])
    }
  }
  if (effectsFailure) {
    throw effectsFailure
  }
  await rows('UPDATE planning.appointment SET effects_error=NULL WHERE id=$1', [id])
}
async function availabilityEffects(id: string) {
  const [window] = await rows<{
    store_id: string
    user_id: string
    data: AvailabilityWindow
    revision: number
    deleted: boolean
    calendar_event_id: string | null
    calendar_id: string | null
  }>('SELECT * FROM planning.availability WHERE id=$1', [id])
  if (!window) {
    return
  }
  const [store] = await rows<{ mode: string }>('SELECT mode FROM products.store WHERE organization_id=$1', [
    window.store_id
  ])
  if (store?.mode === 'sandbox' && !developmentSandboxEffectsEnabled()) {
    return
  }
  const eventId = window.calendar_event_id || `a${id.replace(/-/g, '')}`
  const [provider] = await rows<{ write_calendar_id: string; availability_calendar_title: string }>(
    'SELECT write_calendar_id,availability_calendar_title FROM planning.provider WHERE store_id=$1 AND user_id=$2',
    [window.store_id, window.user_id]
  )
  if (window.deleted) {
    if (window.calendar_id) {
      await calendarAdapter().remove(window.store_id, window.user_id, window.calendar_id, eventId)
    }
    return
  }
  if (!provider?.write_calendar_id) {
    throw new Error('Select a writable calendar')
  }
  if (window.calendar_id && window.calendar_id !== provider.write_calendar_id) {
    await calendarAdapter().remove(window.store_id, window.user_id, window.calendar_id, eventId)
  }
  const w = window.data,
    recurrence: string[] = []
  const products = await rows<{ title: string }>(
    `SELECT COALESCE(NULLIF(data->'content'->'en'->>'title',''),data->'content'->'nl'->>'title',id) AS title
     FROM products.product
     WHERE store_id=$1
       AND data->>'status'<>'archived'
       AND ($3::boolean OR id=ANY($4::text[]))
       AND ($3::boolean IS FALSE OR (data->'planning'->>'enabled'='true' AND data->'planning'->'providerUserIds' ? $2))
     ORDER BY title`,
    [window.store_id, window.user_id, w.productIds === null, w.productIds || []]
  )
  const productDescription = products.length
    ? `Products:\n${products.map((product) => `• ${product.title}`).join('\n')}`
    : 'Products: none'
  if (w.recurring) {
    // UNTIL uses the final occurrence’s actual instant in the series timezone.
    recurrence.push(
      `RRULE:FREQ=WEEKLY${
        w.endDate
          ? `;UNTIL=${wallInstant(w.endDate, w.startTime, w.timezone)
              .toISOString()
              .replace(/[-:]/g, '')
              .replace(/\.\d{3}/, '')}`
          : ''
      }`
    )
    if (w.exceptions.length) {
      recurrence.push(
        `EXDATE;TZID=${w.timezone}:${w.exceptions.map((d) => `${d.replace(/-/g, '')}T${w.startTime.replace(':', '')}00`).join(',')}`
      )
    }
  }
  const written = await calendarAdapter().put(window.store_id, window.user_id, provider.write_calendar_id, {
    id: eventId,
    summary: provider.availability_calendar_title,
    description: productDescription,
    start: { dateTime: calendarWallDateTime(w.date, w.startTime), timeZone: w.timezone },
    end: { dateTime: calendarWallDateTime(w.date, w.endTime), timeZone: w.timezone },
    transparency: 'transparent',
    extendedProperties: { private: { portalPlanning: id, portalRevision: String(window.revision) } },
    ...(recurrence.length ? { recurrence } : {})
  })
  if (
    written?.externalChangeKey ||
    (written?.wasMissing && window.calendar_event_id && window.calendar_id === provider.write_calendar_id)
  ) {
    await enqueue(
      pool,
      `mirror-notice:${id}:${window.revision}:${written.externalChangeKey || 'missing'}`,
      'mirror-notice',
      { userId: window.user_id }
    )
  }
  await rows('UPDATE planning.availability SET calendar_event_id=$2,calendar_id=$3 WHERE id=$1', [
    id,
    eventId,
    provider.write_calendar_id
  ])
}
async function refund(orderId: string, amount: number, key: string) {
  const order = await getOrder(orderId)
  if (!order || !order.payment_id || !amount) {
    return
  }
  if (order.snapshot.storeMode === 'sandbox') {
    await rows('UPDATE products.orders SET refunded=GREATEST(refunded,$2) WHERE id=$1', [orderId, amount])
    await rows('UPDATE products.order_line SET refunded=GREATEST(refunded,$2) WHERE order_id=$1', [orderId, amount])
  } else {
    // Stripe's idempotency key prevents repeat refunds after task retries.
    await stripeProvider.refund(order.payment_id, amount, key)
    const state = await stripeProvider.lookupPayment(order.payment_id)
    await rows('UPDATE products.orders SET refunded=$2 WHERE id=$1', [orderId, state.refunded])
    await rows('UPDATE products.order_line SET refunded=$2 WHERE order_id=$1', [orderId, state.refunded])
  }
  await processOrder(orderId)
}
export async function runJobs(limit = 20, storeId?: string, jobId?: string) {
  const pending = await rows<{ id: string; kind: string; payload: Record<string, unknown>; attempts: number }>(
    `WITH scoped AS (
       SELECT j.*,
         COALESCE(
           j.payload->>'storeId',
           (SELECT a.store_id FROM planning.appointment a WHERE a.id::text=j.payload->>'appointmentId'),
           (SELECT w.store_id FROM planning.availability w WHERE w.id::text=j.payload->>'id'),
           (SELECT o.store_id FROM products.orders o WHERE o.id::text=j.payload->>'orderId')
         ) AS store_id
       FROM planning.job j
       WHERE j.completed_at IS NULL AND j.available_at<=now()
     )
     SELECT * FROM scoped WHERE ($2::text IS NULL OR store_id=$2) AND ($3::text IS NULL OR id=$3) ORDER BY available_at LIMIT $1`,
    [limit, storeId, jobId]
  )
  let completed = 0,
    failed = 0
  for (const job of pending) {
    const client = await pool.connect(),
      key = `planning-job:${job.id}`
    let acquired = false,
      effectsKey: string | undefined
    try {
      acquired = (await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [key]))
        .rows[0]!.locked
      if (!acquired) {
        continue
      }
      const [current] = await rows<{ completed_at: Date | null }>(
        'SELECT completed_at FROM planning.job WHERE id=$1',
        [job.id],
        client
      )
      if (current?.completed_at) {
        continue
      }
      const p = job.payload
      if (job.kind === 'appointment' || job.kind === 'repair') {
        effectsKey = `planning-effects:${p.appointmentId}`
        await client.query('SELECT pg_advisory_lock(hashtext($1))', [effectsKey])
        const repairNotification = job.kind === 'repair' && p.notifyCustomer === true
        const [pendingAppointment] =
          job.kind === 'repair'
            ? await rows<{ id: string }>(
                `SELECT id FROM planning.job WHERE kind='appointment' AND completed_at IS NULL AND payload->>'appointmentId'=$1 AND payload->>'revision'=$2 LIMIT 1`,
                [String(p.appointmentId), String(p.revision)],
                client
              )
            : []
        if (!pendingAppointment) {
          await appointmentEffects(
            String(p.appointmentId),
            Number(p.revision),
            job.kind === 'appointment' || repairNotification,
            repairNotification ? job.id : undefined,
            job.kind === 'appointment'
          )
        }
      } else if (job.kind === 'availability') {
        await availabilityEffects(String(p.id))
      } else if (job.kind === 'refund') {
        await refund(String(p.orderId), Number(p.amount), job.id)
      } else if (job.kind === 'cleanup') {
        if (p.calendarId && p.eventId) {
          const [adopted] = await rows<{ id: string }>(
            "SELECT id FROM planning.appointment WHERE calendar_id=$1 AND calendar_event_id=$2 AND status='confirmed'",
            [p.calendarId, p.eventId]
          )
          if (!adopted) {
            await calendarAdapter().remove(String(p.storeId), String(p.userId), String(p.calendarId), String(p.eventId))
          }
        }
        if (p.meetingId) {
          await meetingAdapter().remove(String(p.storeId), String(p.userId), String(p.meetingId))
        }
      } else if (job.kind === 'close-checkout') {
        const order = await getOrder(String(p.orderId))
        if (order?.checkout_id && !order.checkout_id.startsWith('sandbox:')) {
          await stripeProvider.expireCheckout(order.checkout_id)
          await reconcileCheckout(order.checkout_id)
        }
      } else if (job.kind === 'sync') {
        await syncProvider(String(p.storeId), String(p.userId), String(p.trigger || 'reconciliation'))
      } else if (job.kind === 'failed-booking') {
        const order = await getOrder(String(p.orderId))
        if (order && (order.snapshot.storeMode !== 'sandbox' || developmentSandboxEffectsEnabled())) {
          await sendPortalEmail({
            moduleId: 'planning',
            definition: appointmentEmail,
            locale: order.snapshot.locale,
            to: order.email,
            values: {
              recipient_name: emailRecipientName({
                firstName: order.snapshot.billing.firstName,
                displayName: order.snapshot.billing.name,
                email: order.email
              }),
              product: order.lines[0]!.snapshot.title,
              status:
                order.snapshot.locale === 'nl'
                  ? 'Afspraak kon niet worden bevestigd. Een eventuele betaling wordt terugbetaald.'
                  : 'The appointment could not be confirmed. Any payment will be refunded.',
              time: '',
              timezone: '',
              meetingUrl: `${baseUrl()}/appointments`,
              meetingDetails: '',
              instructions: '',
              url: `${baseUrl()}/appointments`
            },
            idempotencyKey: job.id
          })
        }
      } else if (job.kind === 'conflict' || job.kind === 'mirror-notice') {
        const [provider] = await rows<{ email: string; first_name: string | null; name: string | null }>(
          'SELECT email,first_name,name FROM public."user" WHERE id=$1',
          [p.userId]
        )
        if (provider) {
          await sendPortalEmail({
            moduleId: 'planning',
            definition: appointmentEmail,
            locale: 'en',
            to: provider.email,
            values: {
              recipient_name: emailRecipientName({
                firstName: provider.first_name,
                displayName: provider.name,
                email: provider.email
              }),
              product: job.kind === 'conflict' ? 'Calendar conflict' : 'Calendar synchronization',
              status:
                job.kind === 'conflict'
                  ? 'An external appointment overlaps a confirmed portal appointment. Resolve the conflict in your calendar or contact the customer.'
                  : 'An externally changed or removed portal event was restored. Manage portal availability and appointments in the portal.',
              time: '',
              timezone: '',
              meetingUrl: `${baseUrl()}/planning`,
              meetingDetails: '',
              instructions: '',
              url: `${baseUrl()}/planning`
            },
            idempotencyKey: job.id
          })
        }
      } else {
        throw new Error('Unknown planning job')
      }
      await rows(
        'UPDATE planning.job SET completed_at=now(),last_attempt_at=now(),error=NULL WHERE id=$1',
        [job.id],
        client
      )
      completed++
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : 'Planning task failed'
      const now = new Date()
      const retrySeconds = message.includes('zoom API failed (429)')
        ? Math.max(
            60,
            Math.ceil(
              (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000
            ) + 60
          )
        : Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7))
      await rows(
        "UPDATE planning.job SET attempts=attempts+1,last_attempt_at=now(),error=$2,available_at=now()+($3::int*interval '1 second') WHERE id=$1",
        [job.id, message, retrySeconds],
        client
      )
      if (job.kind === 'appointment') {
        await rows(
          'UPDATE planning.appointment SET effects_error=$2 WHERE id=$1',
          [job.payload.appointmentId, message],
          client
        )
      }
    } finally {
      if (effectsKey) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [effectsKey]).catch(() => undefined)
      }
      if (acquired) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => undefined)
      }
      client.release()
    }
  }
  return { completed, failed }
}
export async function expireReservations() {
  const overdue = await rows<Reservation>(
    "SELECT * FROM planning.reservation WHERE status='reserved' AND expires_at<=now() ORDER BY expires_at LIMIT 50"
  )
  for (const hold of overdue) {
    if (hold.order_id) {
      const order = await getOrder(hold.order_id)
      if (order?.checkout_id && !order.checkout_id.startsWith('sandbox:')) {
        // Close first, then reconcile again: payment may complete while closing checkout.
        await stripeProvider.expireCheckout(order.checkout_id)
        await reconcileCheckout(order.checkout_id)
      }
      const current = await getOrder(hold.order_id)
      if (current?.status === 'paid') {
        await processOrder(current.id)
        continue
      }
    }
    await transaction(async (tx) => {
      await lockProvider(tx, hold.user_id)
      await tx.query("UPDATE planning.reservation SET status='expired' WHERE id=$1 AND status='reserved'", [hold.id])
      if (hold.order_id) {
        await tx.query("UPDATE products.orders SET status='expired' WHERE id=$1 AND status='pending'", [hold.order_id])
      }
    })
  }
  await rows('DELETE FROM planning.oauth_state WHERE expires_at<now()')
}
export async function syncProvider(storeId: string, userId: string, trigger = 'reconciliation') {
  const [p] = await rows<{ busy_calendar_ids: string[] }>(
    'SELECT busy_calendar_ids FROM planning.provider WHERE store_id=$1 AND user_id=$2',
    [storeId, userId]
  )
  if (!p?.busy_calendar_ids.length) {
    return
  }
  const from = new Date(),
    to = new Date(Date.now() + 365 * 86400000)
  const busy = await externalBusy(storeId, userId, p.busy_calendar_ids, from, to)
  const appointments = await rows<Appointment>(
    "SELECT * FROM planning.appointment WHERE store_id=$1 AND user_id=$2 AND status='confirmed' AND end_at>now()",
    [storeId, userId]
  )
  for (const a of appointments) {
    const conflict = busy.some(
      (b) =>
        a.start_at.getTime() < Date.parse(b.end) &&
        a.end_at.getTime() + a.snapshot.graceMinutes * 60000 > Date.parse(b.start)
    )
    if (conflict !== a.conflict) {
      await transaction(async (tx) => {
        await tx.query('UPDATE planning.appointment SET conflict=$2 WHERE id=$1', [a.id, conflict])
        if (conflict) {
          await enqueue(tx, `conflict:${a.id}:${a.revision}:${randomUUID()}`, 'conflict', {
            userId,
            appointmentId: a.id
          })
        }
      })
    }
  }
  const repairBucket = Math.floor(Date.now() / (trigger === 'notification' ? 300000 : 86400000))
  for (const a of appointments) {
    await enqueue(pool, `repair:${a.id}:${a.revision}:${repairBucket}`, 'repair', {
      appointmentId: a.id,
      revision: a.revision,
      trigger
    })
  }
  const windows = await rows<{ id: string }>(
    'SELECT id FROM planning.availability WHERE store_id=$1 AND user_id=$2 AND NOT deleted',
    [storeId, userId]
  )
  for (const w of windows) {
    await enqueue(pool, `availability-repair:${w.id}:${repairBucket}`, 'availability', {
      id: w.id,
      trigger
    })
  }
  if (!baseUrl().startsWith('https://')) {
    return
  }
  for (const calendarId of p.busy_calendar_ids) {
    const [live] = await rows<{ id: string }>(
      "SELECT id FROM planning.watch WHERE store_id=$1 AND user_id=$2 AND calendar_id=$3 AND expires_at>now()+interval '1 hour'",
      [storeId, userId, calendarId]
    )
    if (live) {
      continue
    }
    const id = randomUUID(),
      token = secret()
    // Persist before creating the channel because Google can send its initial notification immediately.
    await rows(
      "INSERT INTO planning.watch(id,store_id,user_id,calendar_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '1 hour')",
      [id, storeId, userId, calendarId, digest(token)]
    )
    const watch = await calendarAdapter().watch(storeId, userId, calendarId, id, token)
    await rows('UPDATE planning.watch SET resource_id=$2,expires_at=$3 WHERE id=$1', [
      id,
      watch.resourceId,
      new Date(Number(watch.expiration))
    ])
  }
}
