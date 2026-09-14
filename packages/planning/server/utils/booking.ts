import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { randomUUID } from 'node:crypto'
import { createError, getCookie, setCookie, type H3Event } from 'h3'
import type { PoolClient } from 'pg'
import type { z } from 'zod'
import { rows, transaction } from '@nuxt-customer-portal/products/server/utils/database'
import { getStore } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct, selectCopy } from '@nuxt-customer-portal/products/server/utils/catalog'
import { defaultPlanningPolicy, effectivePolicy } from '@nuxt-customer-portal/products/shared/planning'
import type { Order } from '@nuxt-customer-portal/products/shared/types'
import type { checkoutSchema } from '@nuxt-customer-portal/products/shared/validation'
import { availabilityQuerySchema, holdSchema, holdCredentialSchema } from '../../shared/validation'
import { generateSlots, canChange, changeFee } from '../../shared/availability'
import type {
  Appointment,
  Interval,
  AvailabilityWindow,
  Reservation,
  PlanningPolicy,
  AppointmentSnapshot
} from '../../shared/types'
import { calendarAdapter } from './adapters'
import { digest, secret } from './crypto'
import { customerAppointment } from './access'

const minute = 60000
export const lockProvider = async (tx: PoolClient, userId: string) => {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`planning:${userId}`])
}
export async function enqueue(
  tx: Pick<PoolClient, 'query'>,
  id: string,
  kind: string,
  payload: Record<string, unknown>
) {
  await tx.query('INSERT INTO planning.job(id,kind,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [
    id,
    kind,
    payload
  ])
}
export async function policy(storeId: string) {
  const [row] = await rows<{ policy: PlanningPolicy }>('SELECT policy FROM planning.settings WHERE store_id=$1', [
    storeId
  ])
  return effectivePolicy(defaultPlanningPolicy(), row?.policy || {})
}
export async function bookingBusy(
  storeId: string,
  userId: string,
  calendarIds: string[],
  from: Date,
  to: Date,
  mode?: string
): Promise<Interval[]> {
  if ((mode ?? (await getStore()).mode) === 'sandbox') {
    return []
  }
  return calendarAdapter().busy(storeId, userId, calendarIds, from, to)
}
export async function providers(storeId: string, productId: string) {
  const product = await getProduct(storeId, productId)
  if (!product.planning?.enabled || product.status !== 'published') {
    throw createError({ statusCode: 404, message: 'This product is not available for booking' })
  }
  const sandbox = (await getStore()).mode === 'sandbox'
  const users = await rows<{
    user_id: string
    name: string
    email: string
    timezone: string
    grace_minutes: number
    busy_calendar_ids: string[]
    write_calendar_id: string
  }>(
    `SELECT DISTINCT p.*,u.name,u.email FROM planning.provider p JOIN public.member m ON m.organization_id=p.store_id AND m.user_id=p.user_id JOIN public."user" u ON u.id=p.user_id WHERE p.store_id=$1 AND p.enabled AND p.user_id=ANY($2::text[]) AND ($4::boolean OR (p.write_calendar_id IS NOT NULL AND cardinality(p.busy_calendar_ids)>0 AND EXISTS(SELECT 1 FROM planning.connection c WHERE c.store_id=p.store_id AND c.user_id=p.user_id AND c.provider='google' AND c.healthy) AND ($3='none' OR EXISTS(SELECT 1 FROM planning.connection z WHERE z.store_id=p.store_id AND z.user_id=p.user_id AND z.provider='zoom' AND z.healthy))))`,
    [storeId, product.planning.providerUserIds, product.planning.meetingProvider, sandbox]
  )
  return { product, users }
}
export async function available(
  productId: string,
  input: unknown,
  options: { tx?: PoolClient; policy?: PlanningPolicy; duration?: number; grace?: number } = {}
) {
  const q = parseInput(availabilityQuerySchema, input),
    store = await getStore(true),
    { product, users } = await providers(store.organization_id, productId)
  const rules =
    options.policy || effectivePolicy(await policy(store.organization_id), product.planning!.policyOverrides)
  const slots = []
  for (const u of users.filter((u) => !q.providerUserId || q.providerUserId === u.user_id)) {
    const windowRows = await rows<{ id: string; data: AvailabilityWindow }>(
      'SELECT id,data FROM planning.availability WHERE store_id=$1 AND user_id=$2 AND NOT deleted',
      [store.organization_id, u.user_id],
      options.tx
    )
    // Each provider failure closes their availability; do not offer stale slots.
    let busy
    try {
      busy = await bookingBusy(
        store.organization_id,
        u.user_id,
        u.busy_calendar_ids,
        new Date(q.from),
        new Date(Date.parse(q.to) + u.grace_minutes * minute)
      )
    } catch {
      continue
    }
    const internal = await rows<{ start_at: Date; blocked_until: Date }>(
      `SELECT start_at,blocked_until FROM planning.reservation WHERE user_id=$1 AND status IN ('reserved','confirmed') AND start_at<$3 AND blocked_until>$2`,
      [u.user_id, q.from, q.to],
      options.tx
    )
    slots.push(
      ...generateSlots({
        from: new Date(q.from),
        to: new Date(q.to),
        now: new Date(),
        durationMinutes: options.duration || product.planning!.durationMinutes!,
        graceMinutes: options.grace ?? u.grace_minutes,
        intervalMinutes: rules.slotIntervalMinutes,
        displayIntervalMinutes: rules.displayIntervalMinutes ?? 30,
        noticeMinutes: rules.minimumNoticeMinutes,
        horizonDays: rules.bookingHorizonDays,
        productId,
        providerUserId: u.user_id,
        providerName: u.name,
        windows: windowRows.map((w) => ({ ...w.data, id: w.id })),
        busy: [
          ...busy,
          ...internal.map((b) => ({ start: b.start_at.toISOString(), end: b.blocked_until.toISOString() }))
        ]
      })
    )
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start) || a.providerUserId.localeCompare(b.providerUserId))
}
const sessions = new WeakMap<H3Event, string>()
function sessionKey(event: H3Event, create = false) {
  let value = getCookie(event, 'planning-session') || sessions.get(event)
  if (!value && create) {
    value = secret()
    sessions.set(event, value)
    setCookie(event, 'planning-session', value, {
      httpOnly: true,
      secure: new URL(process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL!).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400
    })
  }
  if (!value) {
    throw createError({ statusCode: 403, message: 'Reservation session missing; choose a slot again' })
  }
  return value
}
export const holdHash = (event: H3Event, token: string) => digest(`${sessionKey(event)}:${token}`)
export async function releaseHold(event: H3Event, body: unknown) {
  const input = parseInput(holdCredentialSchema, body)
  await transaction(async (tx) => {
    const [hold] = await rows<Reservation>(
      'SELECT * FROM planning.reservation WHERE token_hash=$1 FOR UPDATE',
      [holdHash(event, input.holdToken)],
      tx
    )
    if (!hold || hold.status !== 'reserved') {
      return
    }
    if (hold.order_id) {
      throw createError({
        statusCode: 409,
        message: 'Checkout already started; finish or wait for this reservation to expire'
      })
    }
    await tx.query("UPDATE planning.reservation SET status='expired' WHERE id=$1 AND status='reserved'", [hold.id])
  })
}
export async function reserve(event: H3Event, body: unknown) {
  const input = parseInput(holdSchema, body),
    store = await getStore(true),
    { product, users } = await providers(store.organization_id, input.productId)
  const provider = users.find((u) => u.user_id === input.providerUserId)
  if (!provider) {
    throw createError({ statusCode: 409, message: 'Provider is unavailable' })
  }
  const price = product.prices.find((p) => p.currency === input.currency)
  if (!price) {
    throw createError({ statusCode: 409, message: 'Product price unavailable' })
  }
  let rules = effectivePolicy(await policy(store.organization_id), product.planning!.policyOverrides),
    original: Appointment | undefined
  if (input.replacesId) {
    original = (await customerAppointment(event, input.replacesId)).appointment
    if (
      original.status !== 'confirmed' ||
      original.product_id !== product.id ||
      original.snapshot.currency !== input.currency ||
      !canChange(original.start_at, new Date(), original.snapshot.policy.rescheduleCutoffMinutes)
    ) {
      throw createError({ statusCode: 409, message: 'This appointment cannot be changed' })
    }
    rules = original.snapshot.policy
  }
  const duration = original?.snapshot.durationMinutes || product.planning!.durationMinutes!,
    grace = provider.grace_minutes
  const snapshot: AppointmentSnapshot = {
    organizerEmail: original?.snapshot.organizerEmail || provider.email,
    title: original?.snapshot.title || selectCopy(product, input.locale, store.default_locale).title,
    durationMinutes: duration,
    graceMinutes: grace,
    timezone: provider.timezone,
    customerTimezone: input.customerTimezone,
    policy: rules,
    currency: input.currency,
    unitAmount: price.amount,
    meetingProvider: product.planning!.meetingProvider,
    locale: input.locale
  }
  if (original) {
    snapshot.unitAmount = changeFee(original.changes, rules.freeChanges, rules.changeFees, input.currency)
  }
  // External check precedes the short transaction; internal slots are validated again under lock.
  const end = new Date(Date.parse(input.start) + duration * minute),
    blockedUntil = new Date(end.getTime() + grace * minute)
  const external = await bookingBusy(
    store.organization_id,
    provider.user_id,
    provider.busy_calendar_ids,
    new Date(input.start),
    blockedUntil
  )
  if (
    external.some((b) => Date.parse(input.start) < Date.parse(b.end) && blockedUntil.getTime() > Date.parse(b.start))
  ) {
    throw createError({ statusCode: 409, message: 'This slot is no longer available' })
  }
  sessionKey(event, true)
  const token = secret(),
    id = randomUUID(),
    expiresAt = new Date(Date.now() + rules.reservationMinutes * minute)
  await transaction(async (tx) => {
    if (input.previousHoldToken) {
      const [previous] = await rows<Reservation>(
        'SELECT * FROM planning.reservation WHERE token_hash=$1 FOR UPDATE',
        [holdHash(event, input.previousHoldToken)],
        tx
      )
      if (previous?.status === 'reserved') {
        if (previous.product_id !== product.id || previous.order_id) {
          throw createError({ statusCode: 409, message: 'Previous checkout cannot be replaced' })
        }
        await tx.query("UPDATE planning.reservation SET status='expired' WHERE id=$1", [previous.id])
      }
    }
    await lockProvider(tx, provider.user_id)
    const windows = await rows<{ id: string; data: AvailabilityWindow }>(
      'SELECT id,data FROM planning.availability WHERE store_id=$1 AND user_id=$2 AND NOT deleted',
      [store.organization_id, provider.user_id],
      tx
    )
    const internal = await rows<{ start_at: Date; blocked_until: Date }>(
      "SELECT start_at,blocked_until FROM planning.reservation WHERE user_id=$1 AND status IN ('reserved','confirmed') AND start_at<$3 AND blocked_until>$2",
      [provider.user_id, input.start, blockedUntil],
      tx
    )
    const valid = generateSlots({
      from: new Date(input.start),
      to: end,
      now: new Date(),
      durationMinutes: duration,
      graceMinutes: grace,
      intervalMinutes: rules.slotIntervalMinutes,
      displayIntervalMinutes: rules.displayIntervalMinutes ?? 30,
      noticeMinutes: rules.minimumNoticeMinutes,
      horizonDays: rules.bookingHorizonDays,
      productId: product.id,
      providerUserId: provider.user_id,
      providerName: provider.name,
      windows: windows.map((w) => ({ ...w.data, id: w.id })),
      busy: [
        ...external,
        ...internal.map((b) => ({ start: b.start_at.toISOString(), end: b.blocked_until.toISOString() }))
      ]
    })
    if (!valid.some((s) => Date.parse(s.start) === Date.parse(input.start))) {
      throw createError({ statusCode: 409, message: 'This slot is no longer available' })
    }
    const [currentProduct] = await rows<{
      data: { planning: { enabled: boolean; providerUserIds: string[]; durationMinutes: number } }
    }>('SELECT data FROM products.product WHERE id=$1 FOR SHARE', [product.id], tx)
    const [membership] = await rows<{ id: string }>(
      'SELECT id FROM public.member WHERE organization_id=$1 AND user_id=$2 FOR SHARE',
      [store.organization_id, provider.user_id],
      tx
    )
    if (
      !membership ||
      !currentProduct?.data.planning?.enabled ||
      !currentProduct.data.planning.providerUserIds.includes(provider.user_id)
    ) {
      throw createError({ statusCode: 409, message: 'Provider assignment changed' })
    }
    const active = await providers(store.organization_id, product.id)
    if (
      !active.users.some((u) => u.user_id === provider.user_id) ||
      active.product.planning!.durationMinutes !== product.planning!.durationMinutes
    ) {
      throw createError({ statusCode: 409, message: 'Planning settings changed; refresh availability' })
    }
    if (original) {
      await tx.query('SELECT id FROM planning.appointment WHERE id=$1 FOR UPDATE', [original.id])
      const [current] = await rows<Appointment>('SELECT * FROM planning.appointment WHERE id=$1', [original.id], tx)
      if (current!.status !== 'confirmed' || current!.revision !== original.revision) {
        throw createError({ statusCode: 409, message: 'Appointment changed; refresh' })
      }
      const [pending] = await rows<{ id: string }>(
        "SELECT id FROM planning.reservation WHERE replaces_id=$1 AND status='reserved'",
        [original.id],
        tx
      )
      if (pending) {
        throw createError({ statusCode: 409, message: 'Finish or wait for your pending appointment change' })
      }
    }
    await tx.query(
      `INSERT INTO planning.reservation(id,store_id,user_id,product_id,token_hash,start_at,end_at,blocked_until,expires_at,status,replaces_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'reserved',$10,$11)`,
      [
        id,
        store.organization_id,
        provider.user_id,
        product.id,
        holdHash(event, token),
        new Date(input.start),
        end,
        blockedUntil,
        expiresAt,
        original?.id || null,
        snapshot
      ]
    )
  })
  return {
    holdToken: token,
    expiresAt: expiresAt.toISOString(),
    start: input.start,
    end: end.toISOString(),
    providerName: provider.name,
    amount: snapshot.unitAmount,
    currency: snapshot.currency
  }
}
export async function prepareCheckout(event: H3Event, input: z.infer<typeof checkoutSchema>) {
  if (!input.holdToken) {
    throw createError({ statusCode: 409, message: 'Choose an appointment before checkout' })
  }
  const [hold] = await rows<Reservation>('SELECT * FROM planning.reservation WHERE token_hash=$1', [
    holdHash(event, input.holdToken)
  ])
  if (!hold || hold.product_id !== input.productId || hold.status !== 'reserved' || hold.expires_at <= new Date()) {
    throw createError({ statusCode: 409, message: 'Reservation expired; choose another slot' })
  }
  if (hold.replaces_id) {
    await customerAppointment(event, hold.replaces_id)
  }
  const { users } = await providers(hold.store_id, hold.product_id),
    provider = users.find((u) => u.user_id === hold.user_id)
  if (!provider) {
    throw createError({ statusCode: 409, message: 'Provider unavailable' })
  }
  const busy = await bookingBusy(
    hold.store_id,
    hold.user_id,
    provider.busy_calendar_ids,
    hold.start_at,
    hold.blocked_until
  )
  if (
    busy.some((b) => hold.start_at.getTime() < Date.parse(b.end) && hold.blocked_until.getTime() > Date.parse(b.start))
  ) {
    throw createError({ statusCode: 409, message: 'Calendar conflict; choose another slot' })
  }
  // Hash only travels inside this request and is never accepted from the public API.
  prepared.set(event, { token: input.holdToken, hash: holdHash(event, input.holdToken) })
}
const prepared = new WeakMap<H3Event, { token: string; hash: string }>()
export async function bind(tx: PoolClient, order: Order, hash: string) {
  const [hold] = await rows<Reservation>('SELECT * FROM planning.reservation WHERE token_hash=$1', [hash], tx)
  if (
    !hold ||
    hold.status !== 'reserved' ||
    hold.expires_at <= new Date() ||
    hold.product_id !== order.lines[0]!.product_id ||
    hold.snapshot.currency !== order.lines[0]!.snapshot.price.currency ||
    (hold.order_id && hold.order_id !== order.id)
  ) {
    throw createError({ statusCode: 409, message: 'Reservation is not valid for this checkout' })
  }
  await lockProvider(tx, hold.user_id)
  const [current] = await rows<Reservation>('SELECT * FROM planning.reservation WHERE id=$1 FOR UPDATE', [hold.id], tx)
  if (current!.status !== 'reserved' || current!.expires_at <= new Date()) {
    throw createError({ statusCode: 409, message: 'Reservation expired' })
  }
  const [member] = await rows<{ id: string }>(
    'SELECT m.id FROM public.member m JOIN planning.provider p ON p.store_id=m.organization_id AND p.user_id=m.user_id WHERE p.enabled AND m.organization_id=$1 AND m.user_id=$2',
    [hold.store_id, hold.user_id],
    tx
  )
  if (!member || !order.lines[0]!.snapshot.product.planning?.providerUserIds.includes(hold.user_id)) {
    throw createError({ statusCode: 409, message: 'Provider assignment changed' })
  }
  const line = order.lines[0]!
  if (
    !hold.replaces_id &&
    (hold.snapshot.durationMinutes !== line.snapshot.product.planning?.durationMinutes ||
      hold.snapshot.unitAmount !== line.unit_amount)
  ) {
    throw createError({ statusCode: 409, message: 'Product changed; choose a slot again' })
  }
  if (hold.replaces_id) {
    const [original] = await rows<Appointment>(
      'SELECT * FROM planning.appointment WHERE id=$1 FOR UPDATE',
      [hold.replaces_id],
      tx
    )
    if (
      !original ||
      original.status !== 'confirmed' ||
      !canChange(original.start_at, new Date(), original.snapshot.policy.rescheduleCutoffMinutes) ||
      changeFee(
        original.changes,
        original.snapshot.policy.freeChanges,
        original.snapshot.policy.changeFees,
        original.snapshot.currency
      ) !== hold.snapshot.unitAmount
    ) {
      throw createError({ statusCode: 409, message: 'Appointment change is no longer eligible' })
    }
    const [purchase] = await rows<{ buyer_id: string }>(
      'SELECT buyer_id FROM products.orders WHERE id=$1',
      [original.order_id],
      tx
    )
    if (order.buyer_id !== purchase!.buyer_id) {
      throw createError({ statusCode: 403, message: 'Use your verified email when changing an appointment' })
    }
    line.unit_amount = hold.snapshot.unitAmount
    line.snapshot = {
      ...line.snapshot,
      title: `${original.snapshot.title} — ${hold.snapshot.locale === 'nl' ? 'Afspraak wijzigen' : 'Appointment change'}`,
      price: { ...line.snapshot.price, amount: hold.snapshot.unitAmount },
      product: { ...line.snapshot.product, isFree: hold.snapshot.unitAmount === 0 }
    }
    await tx.query('UPDATE products.order_line SET snapshot=$2,unit_amount=$3 WHERE id=$1', [
      line.id,
      line.snapshot,
      line.unit_amount
    ])
  }
  await tx.query('UPDATE planning.reservation SET order_id=$2 WHERE id=$1', [hold.id, order.id])
  order.snapshot.planningChangeAppointmentId = hold.replaces_id || undefined
  order.snapshot.planningReservationId = hold.id
  order.snapshot.planningExpiresAt = hold.expires_at.toISOString()
  await tx.query('UPDATE products.orders SET snapshot=$2 WHERE id=$1', [order.id, order.snapshot])
}
export async function bindPrepared(event: H3Event, tx: PoolClient, order: Order, token: string) {
  const value = prepared.get(event)
  if (!value || value.token !== token) {
    throw new Error('Reservation preflight missing')
  }
  await bind(tx, order, value.hash)
}
export async function prepareOrder(order: Order) {
  const [hold] = await rows<Reservation>('SELECT * FROM planning.reservation WHERE id=$1 AND order_id=$2', [
    order.snapshot.planningReservationId,
    order.id
  ])
  if (!hold) {
    throw new Error('Order reservation missing')
  }
  if (hold.confirmed_at || order.snapshot.planningFailure) {
    return
  }
  let failure: string | undefined
  if (
    hold.status !== 'reserved' ||
    !order.snapshot.paymentCompletedAt ||
    Date.parse(order.snapshot.paymentCompletedAt) > hold.expires_at.getTime()
  ) {
    failure = 'Reservation expired before payment completed'
  } else {
    const [provider] = await rows<{ busy_calendar_ids: string[] }>(
      'SELECT busy_calendar_ids FROM planning.provider WHERE store_id=$1 AND user_id=$2',
      [hold.store_id, hold.user_id]
    )
    const [member] = await rows<{ id: string }>(
      'SELECT id FROM public.member WHERE organization_id=$1 AND user_id=$2',
      [hold.store_id, hold.user_id]
    )
    if (!member) {
      failure = 'Provider is no longer in the organization'
    }
    const busy = await bookingBusy(
      hold.store_id,
      hold.user_id,
      provider!.busy_calendar_ids,
      hold.start_at,
      hold.blocked_until
    )
    if (
      busy.some(
        (b) => hold.start_at.getTime() < Date.parse(b.end) && hold.blocked_until.getTime() > Date.parse(b.start)
      )
    ) {
      failure = 'Calendar conflict before appointment confirmation'
    }
  }
  if (failure) {
    order.snapshot.planningFailure = failure
    await rows(
      "UPDATE products.orders SET snapshot=jsonb_set(snapshot,'{planningFailure}',to_jsonb($2::text)) WHERE id=$1",
      [order.id, failure]
    )
  }
}
export async function confirm(tx: PoolClient, order: Order) {
  const [hold] = await rows<Reservation>(
    'SELECT * FROM planning.reservation WHERE id=$1 AND order_id=$2',
    [order.snapshot.planningReservationId, order.id],
    tx
  )
  if (!hold) {
    throw new Error('Order reservation missing')
  }
  const id = hold.replaces_id || randomUUID()
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`planning-effects:${id}`])
  await lockProvider(tx, hold.user_id)
  const [current] = await rows<Reservation>('SELECT * FROM planning.reservation WHERE id=$1 FOR UPDATE', [hold.id], tx)
  Object.assign(hold, current)
  if (hold.confirmed_at) {
    return
  }
  if (
    order.snapshot.planningFailure ||
    hold.status !== 'reserved' ||
    !order.snapshot.paymentCompletedAt ||
    Date.parse(order.snapshot.paymentCompletedAt) > hold.expires_at.getTime()
  ) {
    await tx.query(
      "UPDATE products.orders SET snapshot=jsonb_set(snapshot,'{planningFailure}',to_jsonb($2::text)) WHERE id=$1",
      [order.id, order.snapshot.planningFailure || 'Reservation no longer valid']
    )
    await tx.query("UPDATE planning.reservation SET status='expired' WHERE id=$1 AND status='reserved'", [hold.id])
    await enqueue(tx, `failed-booking:${order.id}`, 'failed-booking', { orderId: order.id })
    if (order.total) {
      await enqueue(tx, `late-refund:${order.id}`, 'refund', { orderId: order.id, amount: order.total })
    }
    return
  }
  const line = order.lines[0]!
  if (hold.replaces_id) {
    const [original] = await rows<Appointment>('SELECT * FROM planning.appointment WHERE id=$1 FOR UPDATE', [id], tx)
    if (!original || original.status !== 'confirmed') {
      await tx.query("UPDATE planning.reservation SET status='expired' WHERE id=$1", [hold.id])
      await enqueue(tx, `failed-booking:${order.id}`, 'failed-booking', { orderId: order.id })
      if (order.total) {
        await enqueue(tx, `late-refund:${order.id}`, 'refund', { orderId: order.id, amount: order.total })
      }
      return
    }
    await tx.query("UPDATE planning.reservation SET status='superseded' WHERE id=$1", [original.reservation_id])
    if (original.user_id !== hold.user_id) {
      await enqueue(tx, `cleanup:${id}:${original.revision}`, 'cleanup', {
        storeId: original.store_id,
        userId: original.calendar_user_id || original.user_id,
        calendarId: original.calendar_id,
        eventId: original.calendar_event_id,
        meetingId: original.meeting_id
      })
    }
    const snapshot = {
      ...original.snapshot,
      timezone: hold.snapshot.timezone,
      customerTimezone: hold.snapshot.customerTimezone,
      graceMinutes: hold.snapshot.graceMinutes
    }
    await tx.query(
      `UPDATE planning.appointment SET reservation_id=$2,user_id=$3,start_at=$4,end_at=$5,snapshot=$6,changes=changes+1,revision=revision+1,conflict=false,effects_error=NULL,meeting_id=CASE WHEN user_id=$3 THEN meeting_id ELSE NULL END,meeting_url=CASE WHEN user_id=$3 THEN meeting_url ELSE NULL END,calendar_event_id=CASE WHEN user_id=$3 THEN calendar_event_id ELSE NULL END,calendar_id=CASE WHEN user_id=$3 THEN calendar_id ELSE NULL END,calendar_user_id=CASE WHEN user_id=$3 THEN calendar_user_id ELSE NULL END WHERE id=$1`,
      [id, hold.id, hold.user_id, hold.start_at, hold.end_at, snapshot]
    )
  } else {
    await tx.query(
      `INSERT INTO planning.appointment(id,store_id,reservation_id,order_line_id,order_id,user_id,product_id,start_at,end_at,status,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',$10)`,
      [
        id,
        hold.store_id,
        hold.id,
        line.id,
        order.id,
        hold.user_id,
        hold.product_id,
        hold.start_at,
        hold.end_at,
        hold.snapshot
      ]
    )
  }
  await tx.query("UPDATE planning.reservation SET status='confirmed',confirmed_at=now() WHERE id=$1", [hold.id])
  const [a] = await rows<Appointment>('SELECT * FROM planning.appointment WHERE id=$1', [id], tx)
  await tx.query('INSERT INTO planning.audit(id,appointment_id,actor_id,action,data) VALUES($1,$2,$3,$4,$5)', [
    randomUUID(),
    id,
    order.buyer_id,
    hold.replaces_id ? 'rescheduled' : 'booked',
    { reservationId: hold.id, changeOrderId: hold.replaces_id ? order.id : null }
  ])
  await enqueue(tx, `appointment:${id}:${a!.revision}`, 'appointment', { appointmentId: id, revision: a!.revision })
}
