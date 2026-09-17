import { randomUUID } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { rows, transaction } from '@nuxt-customer-portal/products/server/utils/database'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { staffRescheduleSchema } from '../../shared/validation'
import { generateSlots } from '../../shared/availability'
import type { Appointment, AvailabilityWindow } from '../../shared/types'
import { appointmentAccess, planningAdmin } from './access'
import { providers, lockProvider, enqueue, bookingBusy } from './booking'
import { getStore } from '@nuxt-customer-portal/products/server/utils/access'
import { auditLock } from './jobs'
import { digest } from './crypto'

export async function staffReschedule(event: H3Event, id: string, body: unknown) {
  await planningAdmin(event)
  const input = parseInput(staffRescheduleSchema, body),
    { appointment: initial, userId } = await appointmentAccess(event, id, true)
  const { users } = await providers(initial.store_id, initial.product_id),
    provider = users.find((u) => u.user_id === input.providerUserId)
  if (!provider) {
    throw createError({ statusCode: 409, message: 'Choose an eligible team member' })
  }
  if (initial.snapshot.meetingProvider === 'zoom' && (await getStore()).mode !== 'sandbox') {
    const [connection] = await rows(
      "SELECT user_id FROM planning.connection WHERE store_id=$1 AND user_id=$2 AND provider='zoom' AND healthy",
      [initial.store_id, provider.user_id]
    )
    if (!connection) {
      throw createError({ statusCode: 409, message: 'A healthy Zoom connection is required' })
    }
  }
  const start = new Date(input.start),
    end = new Date(start.getTime() + initial.snapshot.durationMinutes * 60000),
    blocked = new Date(end.getTime() + provider.grace_minutes * 60000)
  const busy = await bookingBusy(initial.store_id, provider.user_id, provider.busy_calendar_ids, start, blocked)
  try {
    await transaction(async (tx) => {
      await auditLock(tx, id)
      for (const memberId of [...new Set([initial.user_id, provider.user_id])].sort()) {
        await lockProvider(tx, memberId)
      }
      const [a] = await rows<Appointment>(
        'SELECT * FROM planning.appointment WHERE id=$1 AND store_id=$2 FOR UPDATE',
        [id, initial.store_id],
        tx
      )
      if (!a || a.status !== 'confirmed' || a.revision !== input.revision) {
        throw createError({ statusCode: 409, message: 'Appointment changed; reload before editing' })
      }
      const [pending] = await rows(
        "SELECT id FROM planning.reservation WHERE replaces_id=$1 AND status='reserved'",
        [id],
        tx
      )
      if (pending) {
        throw createError({ statusCode: 409, message: 'Abandon or complete the pending customer change first' })
      }
      const [eligible] = await rows(
        `SELECT p.user_id FROM planning.provider p JOIN public.member m ON m.user_id=p.user_id AND m.organization_id=p.store_id JOIN planning.connection c ON c.store_id=p.store_id AND c.user_id=p.user_id AND c.provider='google' AND c.healthy WHERE p.store_id=$1 AND p.user_id=$2 AND p.enabled AND p.write_calendar_id=$3 AND p.grace_minutes=$4 AND p.busy_calendar_ids=$5`,
        [a.store_id, provider.user_id, provider.write_calendar_id, provider.grace_minutes, provider.busy_calendar_ids],
        tx
      )
      const [product] = await rows(
        `SELECT id FROM products.product WHERE id=$1 AND store_id=$2 AND data->'planning'->>'enabled'='true' AND data->'planning'->'providerUserIds' ? $3 FOR SHARE`,
        [a.product_id, a.store_id, provider.user_id],
        tx
      )
      if (!eligible || !product) {
        throw createError({ statusCode: 409, message: 'Team member planning settings changed' })
      }
      const windows = await rows<{ data: AvailabilityWindow }>(
        'SELECT data FROM planning.availability WHERE store_id=$1 AND user_id=$2 AND NOT deleted',
        [a.store_id, provider.user_id],
        tx
      )
      const internal = await rows<{ start_at: Date; blocked_until: Date }>(
        "SELECT start_at,blocked_until FROM planning.reservation WHERE user_id=$1 AND status IN ('reserved','confirmed') AND start_at<$3 AND blocked_until>$2 AND id<>$4",
        [provider.user_id, start, blocked, a.reservation_id],
        tx
      )
      const slots = generateSlots({
        from: start,
        to: end,
        now: new Date(),
        durationMinutes: a.snapshot.durationMinutes,
        graceMinutes: provider.grace_minutes,
        intervalMinutes: a.snapshot.policy.slotIntervalMinutes,
        displayIntervalMinutes: a.snapshot.policy.displayIntervalMinutes ?? 30,
        noticeMinutes: 0,
        horizonDays: a.snapshot.policy.bookingHorizonDays,
        productId: a.product_id,
        providerUserId: provider.user_id,
        providerName: provider.name,
        windows: windows.map((w) => w.data),
        busy: [
          ...busy,
          ...internal.map((h) => ({ start: h.start_at.toISOString(), end: h.blocked_until.toISOString() }))
        ]
      })
      if (!slots.some((slot) => slot.start === start.toISOString())) {
        throw createError({ statusCode: 409, message: 'This slot is no longer available' })
      }
      const reservationId = randomUUID(),
        snapshot = {
          ...a.snapshot,
          timezone: provider.timezone,
          customerTimezone: input.customerTimezone,
          graceMinutes: provider.grace_minutes
        }
      await tx.query("UPDATE planning.reservation SET status='superseded' WHERE id=$1", [a.reservation_id])
      await tx.query(
        "INSERT INTO planning.reservation(id,store_id,user_id,product_id,token_hash,start_at,end_at,blocked_until,expires_at,status,confirmed_at,replaces_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),'confirmed',now(),$9,$10)",
        [
          reservationId,
          a.store_id,
          provider.user_id,
          a.product_id,
          digest(randomUUID()),
          start,
          end,
          blocked,
          id,
          snapshot
        ]
      )
      if (a.user_id !== provider.user_id) {
        await enqueue(tx, `cleanup:${id}:${a.revision}`, 'cleanup', {
          storeId: a.store_id,
          userId: a.calendar_user_id || a.user_id,
          calendarId: a.calendar_id,
          eventId: a.calendar_event_id,
          meetingId: a.meeting_id
        })
      }
      await tx.query(
        `UPDATE planning.appointment SET reservation_id=$2,user_id=$3,start_at=$4,end_at=$5,snapshot=$6,revision=revision+1,conflict=false,effects_error=NULL,meeting_id=CASE WHEN user_id=$3 THEN meeting_id ELSE NULL END,meeting_url=CASE WHEN user_id=$3 THEN meeting_url ELSE NULL END,calendar_event_id=CASE WHEN user_id=$3 THEN calendar_event_id ELSE NULL END,calendar_id=CASE WHEN user_id=$3 THEN calendar_id ELSE NULL END,calendar_user_id=CASE WHEN user_id=$3 THEN calendar_user_id ELSE NULL END WHERE id=$1`,
        [id, reservationId, provider.user_id, start, end, snapshot]
      )
      await tx.query('INSERT INTO planning.audit(id,appointment_id,actor_id,action,data) VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        id,
        userId,
        'staff_rescheduled',
        { previousStart: a.start_at, start, providerUserId: provider.user_id }
      ])
      await enqueue(tx, `appointment:${id}:${a.revision + 1}`, 'appointment', {
        appointmentId: id,
        revision: a.revision + 1
      })
    })
  } catch (error) {
    if ((error as { code?: string }).code === '23P01') {
      throw createError({ statusCode: 409, message: 'This slot is no longer available' })
    }
    throw error
  }
  return { success: true }
}
