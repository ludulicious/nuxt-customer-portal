import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { randomUUID } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { z } from 'zod'
import { rows, transaction } from '@nuxt-customer-portal/products/server/utils/database'
import { stripeProvider } from '@nuxt-customer-portal/products/server/utils/payments'
import { reconcileCheckout, getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { getProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { productPlanningSchema, planningPolicySchema } from '@nuxt-customer-portal/products/shared/planning'
import { canChange, changeFee, refundAmount } from '../../shared/availability'
import { availabilityEditSchema, providerSettingsSchema } from '../../shared/validation'
import type { Appointment, ProviderSettings, AvailabilityWindow } from '../../shared/types'
import { planningAdmin, providerAccess, appointmentAccess } from './access'
import { calendarAdapter } from './adapters'
import { enqueue, lockProvider, policy } from './booking'
import { auditLock } from './jobs'

export async function listProviders(event: H3Event): Promise<ProviderSettings[]> {
  const context = await planningAdmin(event)
  return rows<ProviderSettings>(
    `SELECT u.id AS "userId",u.name,u.image,COALESCE(p.enabled,false) AS enabled,COALESCE(p.timezone,u.timezone,os.timezone,'Europe/Amsterdam') AS timezone,COALESCE(p.grace_minutes,0) AS "graceMinutes",COALESCE(p.busy_calendar_ids,'{}') AS "busyCalendarIds",p.write_calendar_id AS "writeCalendarId",EXISTS(SELECT 1 FROM planning.connection c WHERE c.store_id=m.organization_id AND c.user_id=u.id AND c.provider='google' AND c.healthy) AS "googleConnected",EXISTS(SELECT 1 FROM planning.connection c WHERE c.store_id=m.organization_id AND c.user_id=u.id AND c.provider='zoom' AND c.healthy) AS "zoomConnected" FROM public.member m JOIN public."user" u ON u.id=m.user_id LEFT JOIN planning.provider p ON p.store_id=m.organization_id AND p.user_id=u.id LEFT JOIN public.organization_settings os ON os.organization_id=m.organization_id WHERE m.organization_id=$1 ORDER BY u.name`,
    [context.organizationId]
  )
}
export async function setEnabled(event: H3Event, userId: string, body: unknown) {
  const context = await planningAdmin(event),
    input = parseInput(z.object({ enabled: z.boolean() }), body)
  await transaction(async (tx) => {
    await lockProvider(tx, userId)
    const [member] = await rows<{ id: string }>(
      'SELECT id FROM public.member WHERE organization_id=$1 AND user_id=$2',
      [context.organizationId, userId],
      tx
    )
    if (!member) {
      throw createError({ statusCode: 404, message: 'Provider member not found' })
    }
    await tx.query(
      `INSERT INTO planning.provider(store_id,user_id,enabled,timezone) SELECT $1,u.id,$3,COALESCE(u.timezone,os.timezone,'Europe/Amsterdam') FROM public."user" u LEFT JOIN public.organization_settings os ON os.organization_id=$1 WHERE u.id=$2 ON CONFLICT(store_id,user_id) DO UPDATE SET enabled=$3`,
      [context.organizationId, userId, input.enabled]
    )
  })
  return { success: true }
}
export async function ownSettings(event: H3Event) {
  const { storeId, userId } = await providerAccess(event)
  const [p] = await rows<{
    enabled: boolean
    timezone: string
    grace_minutes: number
    busy_calendar_ids: string[]
    write_calendar_id: string | null
  }>('SELECT * FROM planning.provider WHERE store_id=$1 AND user_id=$2', [storeId, userId])
  const connections = await rows<{ provider: string; healthy: boolean; error: string | null }>(
    'SELECT provider,healthy,error FROM planning.connection WHERE store_id=$1 AND user_id=$2',
    [storeId, userId]
  )
  const products = await rows<{ id: string; title: string; thumbnailImageId: string | null }>(
    `SELECT id,COALESCE(NULLIF(data->'content'->'en'->>'title',''),data->'content'->'nl'->>'title') AS title, COALESCE(data->>'thumbnailImageId', data->'imageIds'->>0) AS "thumbnailImageId" FROM products.product WHERE store_id=$1 AND data->'planning'->>'enabled'='true' AND data->'planning'->'providerUserIds' ? $2 AND data->>'status'<>'archived' ORDER BY title`,
    [storeId, userId]
  )
  return {
    enabled: p!.enabled,
    timezone: p!.timezone,
    graceMinutes: p!.grace_minutes,
    busyCalendarIds: p!.busy_calendar_ids,
    writeCalendarId: p!.write_calendar_id,
    connections,
    products
  }
}
export async function saveOwnSettings(event: H3Event, body: unknown) {
  const { storeId, userId } = await providerAccess(event),
    input = parseInput(providerSettingsSchema, body),
    calendars = await calendarAdapter().calendars(storeId, userId)
  if (
    input.busyCalendarIds.some((id) => !calendars.some((c) => c.id === id)) ||
    !calendars.some((c) => c.id === input.writeCalendarId && ['owner', 'writer'].includes(c.accessRole))
  ) {
    throw createError({ statusCode: 400, message: 'Choose accessible calendars and a writable destination' })
  }
  await transaction(async (tx) => {
    await lockProvider(tx, userId)
    await tx.query(
      'UPDATE planning.provider SET timezone=$3,grace_minutes=$4,busy_calendar_ids=$5,write_calendar_id=$6 WHERE store_id=$1 AND user_id=$2',
      [
        storeId,
        userId,
        input.timezone,
        input.graceMinutes,
        [...new Set([...input.busyCalendarIds, input.writeCalendarId])],
        input.writeCalendarId
      ]
    )
    const windows = await rows<{ id: string; revision: number }>(
      "UPDATE planning.availability SET data=jsonb_set(data,'{timezone}',to_jsonb($3::text)),revision=revision+1 WHERE store_id=$1 AND user_id=$2 RETURNING id,revision",
      [storeId, userId, input.timezone],
      tx
    )
    for (const w of windows) {
      await enqueue(tx, `availability:${w.id}:${w.revision}`, 'availability', { id: w.id })
    }
    const appointments = await rows<Appointment>(
      "UPDATE planning.appointment SET revision=revision+1 WHERE store_id=$1 AND user_id=$2 AND status='confirmed' AND end_at>now() RETURNING *",
      [storeId, userId],
      tx
    )
    for (const a of appointments) {
      await enqueue(tx, `appointment:${a.id}:${a.revision}`, 'appointment', {
        appointmentId: a.id,
        revision: a.revision
      })
    }
    await enqueue(tx, `sync:${storeId}:${userId}:${randomUUID()}`, 'sync', { storeId, userId })
  })
  return ownSettings(event)
}
export async function windows(event: H3Event) {
  const { storeId, userId } = await providerAccess(event)
  const found = await rows<{ id: string; data: AvailabilityWindow }>(
    'SELECT id,data FROM planning.availability WHERE store_id=$1 AND user_id=$2 AND NOT deleted',
    [storeId, userId]
  )
  return found.map((w) => ({ ...w.data, id: w.id }))
}
export async function saveWindow(event: H3Event, body: unknown, id?: string) {
  const { storeId, userId } = await providerAccess(event),
    input = parseInput(availabilityEditSchema, body)
  const settings = await ownSettings(event)
  if (input.productIds?.some((productId) => !settings.products.some((p) => p.id === productId))) {
    throw createError({ statusCode: 400, message: 'Select your assigned plannable products' })
  }
  return transaction(async (tx) => {
    await lockProvider(tx, userId)
    let existing: { data: AvailabilityWindow; revision: number } | undefined
    if (id) {
      ;[existing] = await rows<{ data: AvailabilityWindow; revision: number }>(
        'SELECT data,revision FROM planning.availability WHERE id=$1 AND store_id=$2 AND user_id=$3 AND NOT deleted FOR UPDATE',
        [id, storeId, userId],
        tx
      )
      if (!existing) {
        throw createError({ statusCode: 404, message: 'Availability not found' })
      }
    }
    if (input.occurrenceDate && existing) {
      if (
        !existing.data.recurring ||
        new Date(input.occurrenceDate).getUTCDay() !== new Date(existing.data.date).getUTCDay() ||
        input.occurrenceDate < existing.data.date ||
        (existing.data.endDate && input.occurrenceDate > existing.data.endDate)
      ) {
        throw createError({ statusCode: 400, message: 'Choose an occurrence in this series' })
      }
      const exception = {
        ...existing.data,
        exceptions: [...new Set([...existing.data.exceptions, input.occurrenceDate])]
      }
      await tx.query('UPDATE planning.availability SET data=$2,revision=revision+1 WHERE id=$1', [id, exception])
      await enqueue(tx, `availability:${id}:${existing.revision + 1}`, 'availability', { id })
      id = undefined
      input.recurring = false
      input.endDate = null
      input.exceptions = []
    }
    const { occurrenceDate: _occurrence, ...data } = input,
      newId = id || randomUUID()
    const window: AvailabilityWindow = {
      ...data,
      id: newId,
      userId,
      timezone: existing && id ? existing.data.timezone : settings.timezone
    }
    const [saved] = await rows<{ revision: number }>(
      'INSERT INTO planning.availability(id,store_id,user_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET data=$4,revision=planning.availability.revision+1 RETURNING revision',
      [newId, storeId, userId, window],
      tx
    )
    await enqueue(tx, `availability:${newId}:${saved!.revision}`, 'availability', { id: newId })
    return window
  })
}
export async function deleteWindow(event: H3Event, id: string, occurrence?: string) {
  const { storeId, userId } = await providerAccess(event)
  return transaction(async (tx) => {
    await lockProvider(tx, userId)
    const [w] = await rows<{ data: AvailabilityWindow; revision: number }>(
      'SELECT data,revision FROM planning.availability WHERE id=$1 AND store_id=$2 AND user_id=$3 AND NOT deleted FOR UPDATE',
      [id, storeId, userId],
      tx
    )
    if (!w) {
      throw createError({ statusCode: 404, message: 'Availability not found' })
    }
    if (occurrence) {
      z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .parse(occurrence)
      if (
        !w.data.recurring ||
        occurrence < w.data.date ||
        (w.data.endDate && occurrence > w.data.endDate) ||
        new Date(occurrence).getUTCDay() !== new Date(w.data.date).getUTCDay()
      ) {
        throw createError({ statusCode: 400, message: 'Invalid occurrence' })
      }
      await tx.query('UPDATE planning.availability SET data=$2,revision=revision+1 WHERE id=$1', [
        id,
        { ...w.data, exceptions: [...new Set([...w.data.exceptions, occurrence])] }
      ])
    } else {
      await tx.query('UPDATE planning.availability SET deleted=true,revision=revision+1 WHERE id=$1', [id])
    }
    await enqueue(tx, `availability:${id}:${w.revision + 1}`, 'availability', { id })
    return { success: true }
  })
}
export async function appointmentDetails(event: H3Event, id: string) {
  const { appointment: a, staff, canManage } = await appointmentAccess(event, id),
    order = await getOrder(a.order_id),
    now = new Date()
  let fee: number | null = null
  try {
    fee = changeFee(a.changes, a.snapshot.policy.freeChanges, a.snapshot.policy.changeFees, a.snapshot.currency)
  } catch {
    /* A missing currency fee disables paid self-service changes. */
  }
  const [provider] = await rows<{ name: string }>('SELECT name FROM public."user" WHERE id=$1', [a.user_id])
  const [pending] = await rows<{ expires_at: Date }>(
    "SELECT expires_at FROM planning.reservation WHERE replaces_id=$1 AND status='reserved' ORDER BY expires_at DESC LIMIT 1",
    [id]
  )
  return {
    staff,
    canManage,
    revision: a.revision,
    pendingChangeExpiresAt: pending?.expires_at || null,
    id: a.id,
    productId: a.product_id,
    productSlug: order!.lines[0]!.snapshot.product.slug,
    title: a.snapshot.title,
    providerName: provider!.name,
    start: a.start_at,
    end: a.end_at,
    status: a.status,
    customerTimezone: a.snapshot.customerTimezone,
    currency: a.snapshot.currency,
    meetingUrl: a.meeting_url,
    changes: a.changes,
    freeChanges: a.snapshot.policy.freeChanges,
    changeFee: fee,
    canReschedule:
      a.status === 'confirmed' &&
      canManage &&
      !pending &&
      (staff || (fee !== null && canChange(a.start_at, now, a.snapshot.policy.rescheduleCutoffMinutes))),
    canCancel:
      a.status === 'confirmed' &&
      canManage &&
      (staff ||
        (a.snapshot.policy.cancellationEnabled &&
          canChange(a.start_at, now, a.snapshot.policy.cancellationCutoffMinutes))),
    refundAmount:
      a.snapshot.policy.cancellationEnabled && canChange(a.start_at, now, a.snapshot.policy.cancellationCutoffMinutes)
        ? refundAmount(order!.total || 0, order!.refunded, a.snapshot.policy.refundPercentage)
        : 0,
    conflict: a.conflict
  }
}
export async function cancel(event: H3Event, id: string) {
  const { appointment: initial, userId, staff } = await appointmentAccess(event, id, true)
  return transaction(async (tx) => {
    await auditLock(tx, id)
    await lockProvider(tx, initial.user_id)
    const [a] = await rows<Appointment>('SELECT * FROM planning.appointment WHERE id=$1 FOR UPDATE', [id], tx)
    if (a!.status === 'cancelled') {
      return { success: true }
    }
    if (
      !staff &&
      (!a!.snapshot.policy.cancellationEnabled ||
        !canChange(a!.start_at, new Date(), a!.snapshot.policy.cancellationCutoffMinutes))
    ) {
      throw createError({ statusCode: 409, message: 'Cancellation is not permitted by this appointment policy' })
    }
    const [order] = await rows<{ total: number; refunded: number }>(
      'SELECT total,refunded FROM products.orders WHERE id=$1 FOR UPDATE',
      [a!.order_id],
      tx
    )
    const amount =
      a!.snapshot.policy.cancellationEnabled &&
      canChange(a!.start_at, new Date(), a!.snapshot.policy.cancellationCutoffMinutes)
        ? refundAmount(order!.total || 0, order!.refunded, a!.snapshot.policy.refundPercentage)
        : 0
    await tx.query(
      "UPDATE planning.appointment SET status='cancelled',revision=revision+1,conflict=false WHERE id=$1",
      [id]
    )
    await tx.query("UPDATE planning.reservation SET status='cancelled' WHERE id=$1", [a!.reservation_id])
    const replacements = await rows<{ id: string; order_id: string | null }>(
      "UPDATE planning.reservation SET status='cancelled' WHERE replaces_id=$1 AND status='reserved' RETURNING id,order_id",
      [id],
      tx
    )
    for (const h of replacements) {
      if (h.order_id) {
        await enqueue(tx, `close:${h.order_id}`, 'close-checkout', { orderId: h.order_id })
      }
    }
    await tx.query('INSERT INTO planning.audit(id,appointment_id,actor_id,action,data) VALUES($1,$2,$3,$4,$5)', [
      randomUUID(),
      id,
      userId,
      'cancelled',
      { refundAmount: amount }
    ])
    await enqueue(tx, `appointment:${id}:${a!.revision + 1}`, 'appointment', {
      appointmentId: id,
      revision: a!.revision + 1
    })
    if (amount) {
      await enqueue(tx, `cancel-refund:${id}`, 'refund', { orderId: a!.order_id, amount })
    }
    return { success: true, refundAmount: amount }
  })
}
export async function getPolicy(event: H3Event) {
  const context = await planningAdmin(event)
  return policy(context.organizationId)
}
export async function savePolicy(event: H3Event, body: unknown) {
  const context = await planningAdmin(event),
    input = parseInput(planningPolicySchema, body)
  await rows(
    'INSERT INTO planning.settings(store_id,policy) VALUES($1,$2) ON CONFLICT(store_id) DO UPDATE SET policy=$2',
    [context.organizationId, input]
  )
  return input
}

export async function abandonChange(event: H3Event, id: string) {
  await appointmentAccess(event, id, true)
  const pending = await rows<{ id: string; user_id: string; order_id: string | null }>(
    "SELECT id,user_id,order_id FROM planning.reservation WHERE replaces_id=$1 AND status='reserved'",
    [id]
  )
  for (const hold of pending) {
    if (hold.order_id) {
      const order = await getOrder(hold.order_id)
      if (order?.checkout_id && !order.checkout_id.startsWith('sandbox:')) {
        await stripeProvider.expireCheckout(order.checkout_id)
        await reconcileCheckout(order.checkout_id)
      }
    }
    await transaction(async (tx) => {
      await auditLock(tx, id)
      await lockProvider(tx, hold.user_id)
      await rows('SELECT id FROM planning.reservation WHERE id=$1 FOR UPDATE', [hold.id], tx)
      if (hold.order_id) {
        const [order] = await rows<{ status: string }>(
          'SELECT status FROM products.orders WHERE id=$1 FOR UPDATE',
          [hold.order_id],
          tx
        )
        if (order?.status === 'paid') {
          return
        }
        await tx.query("UPDATE products.orders SET status='expired' WHERE id=$1 AND status='pending'", [hold.order_id])
      }
      await tx.query("UPDATE planning.reservation SET status='cancelled' WHERE id=$1 AND status='reserved'", [hold.id])
    })
  }
  return appointmentDetails(event, id)
}

export async function saveProductPlanning(event: H3Event, id: string, body: unknown) {
  const context = await planningAdmin(event)
  const input = parseInput(productPlanningSchema, body)
  await transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${id}`])
    const [product] = await rows<{ data: { type: string; planning?: { providerUserIds: string[] } } }>(
      'SELECT data FROM products.product WHERE id=$1 AND store_id=$2 FOR UPDATE',
      [id, context.organizationId],
      tx
    )
    if (!product) {
      throw createError({ statusCode: 404, message: 'Product not found' })
    }
    if (product.data.type !== 'service') {
      throw createError({ statusCode: 400, message: 'Only service products support planning' })
    }
    if (input.enabled) {
      const members = await rows<{ user_id: string; enabled: boolean }>(
        'SELECT m.user_id,COALESCE(p.enabled,false) AS enabled FROM public.member m LEFT JOIN planning.provider p ON p.store_id=m.organization_id AND p.user_id=m.user_id WHERE m.organization_id=$1 AND m.user_id=ANY($2::text[])',
        [context.organizationId, input.providerUserIds],
        tx
      )
      const previous = product.data.planning?.providerUserIds || []
      if (
        input.providerUserIds.some(
          (userId) => !members.some((m) => m.user_id === userId && (m.enabled || previous.includes(userId)))
        )
      ) {
        throw createError({
          statusCode: 400,
          message: 'Select organization team members with planning enabled',
          data: { field: 'planning.providerUserIds' }
        })
      }
    }
    await tx.query(
      "UPDATE products.product SET data=jsonb_set(data,'{planning}',$3::jsonb),updated_at=now() WHERE id=$1 AND store_id=$2",
      [id, context.organizationId, JSON.stringify(input)]
    )
  })
  return getProduct(context.organizationId, id)
}
