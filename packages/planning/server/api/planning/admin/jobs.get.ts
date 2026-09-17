import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { planningAdmin } from '@nuxt-customer-portal/planning/server/utils/access'
import { getStore } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(200).default(''),
  status: z.enum(['all', 'failed', 'queued', 'succeeded']).default('failed'),
  kind: z.string().trim().max(50).default('all'),
  sort: z.enum(['lastEvent', 'attempts', 'kind']).default('lastEvent'),
  direction: z.enum(['asc', 'desc']).default('desc')
})

const scopedJobs = `WITH scoped AS (
  SELECT j.id,j.kind,j.attempts,j.error,j.available_at,j.completed_at,j.payload->>'trigger' AS trigger,
    j.payload->>'appointmentId' AS appointment_id,
    COALESCE(j.completed_at,j.last_attempt_at,j.created_at) AS last_event_at,
    COALESCE(
      j.payload->>'storeId',
      (SELECT a.store_id FROM planning.appointment a WHERE a.id::text=j.payload->>'appointmentId'),
      (SELECT w.store_id FROM planning.availability w WHERE w.id::text=j.payload->>'id'),
      (SELECT o.store_id FROM products.orders o WHERE o.id::text=j.payload->>'orderId')
    ) AS store_id,
    COALESCE(
      (SELECT a.snapshot->>'title' FROM planning.appointment a WHERE a.id::text=j.payload->>'appointmentId'),
      (SELECT u.name FROM public."user" u WHERE u.id=j.payload->>'userId'),
      j.payload->>'orderId',j.payload->>'id'
    ) AS subject
  FROM planning.job j
)`

export default defineEventHandler(async (event) => {
  await planningAdmin(event)
  const store = await getStore()
  const query = querySchema.parse(getQuery(event))
  const pageSize = 20
  const filters: string[] = ['store_id=$1']
  const params: unknown[] = [store.organization_id]
  if (query.search) {
    params.push(`%${query.search}%`)
    filters.push(
      `(id ILIKE $${params.length} OR kind ILIKE $${params.length} OR COALESCE(error,'') ILIKE $${params.length} OR COALESCE(subject,'') ILIKE $${params.length})`
    )
  }
  if (query.status !== 'all') {
    filters.push(
      {
        failed: 'completed_at IS NULL AND error IS NOT NULL',
        queued: 'completed_at IS NULL AND error IS NULL',
        succeeded: 'completed_at IS NOT NULL'
      }[query.status]
    )
  }
  if (query.kind !== 'all') {
    params.push(query.kind)
    filters.push(`kind=$${params.length}`)
  }
  const order = { lastEvent: 'last_event_at', attempts: 'attempts', kind: 'kind' }[query.sort]
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  const where = filters.join(' AND ')
  const [count] = await rows<{ total: number }>(
    `${scopedJobs} SELECT count(*)::int AS total FROM scoped WHERE ${where}`,
    params
  )
  params.push(pageSize, (query.page - 1) * pageSize)
  const items = await rows<{
    id: string
    kind: string
    attempts: number
    error: string | null
    subject: string | null
    availableAt: Date
    lastEventAt: Date
    completedAt: Date | null
    trigger: string | null
    appointmentId: string | null
    entity?: unknown
  }>(
    `${scopedJobs} SELECT id,kind,attempts,error,subject,trigger,appointment_id AS "appointmentId",available_at AS "availableAt",last_event_at AS "lastEventAt",completed_at AS "completedAt" FROM scoped WHERE ${where} ORDER BY ${order} ${direction},id ${direction} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const appointmentIds = [...new Set(items.map((item) => item.appointmentId).filter(Boolean))] as string[]
  if (appointmentIds.length) {
    const entities = await rows<{
      id: string
      status: string
      title: string
      startAt: Date
      endAt: Date
      timezone: string
      hostName: string
      hostEmail: string
      customerName: string
      customerEmail: string
      bookingReference: string
      meetingId: string | null
      meetingUrl: string | null
    }>(
      `SELECT a.id::text AS id,a.status,a.snapshot->>'title' AS title,a.start_at AS "startAt",a.end_at AS "endAt",
        COALESCE(a.snapshot->>'timezone','UTC') AS timezone,u.name AS "hostName",u.email AS "hostEmail",
        COALESCE(NULLIF(o.snapshot->'billing'->>'name',''),NULLIF(o.snapshot->'billing'->>'firstName',''),o.email) AS "customerName",
        o.email AS "customerEmail",o.booking_reference AS "bookingReference",a.meeting_id AS "meetingId",a.meeting_url AS "meetingUrl"
       FROM planning.appointment a
       JOIN public."user" u ON u.id=a.user_id
       JOIN products.orders o ON o.id=a.order_id
       WHERE a.store_id=$1 AND a.id=ANY($2::uuid[])`,
      [store.organization_id, appointmentIds]
    )
    const byId = new Map(entities.map((entity) => [entity.id, entity]))
    for (const item of items) {
      if (!item.appointmentId) {
        continue
      }
      const entity = byId.get(item.appointmentId)
      if (!entity) {
        continue
      }
      item.subject = entity.title
      item.entity = { type: 'appointment', ...entity }
    }
  }
  const availabilityIds = items
    .filter((item) => item.kind === 'availability' && item.subject)
    .map((item) => item.subject as string)
  if (availabilityIds.length) {
    const entities = await rows<{
      id: string
      providerName: string
      providerEmail: string
      calendarId: string | null
      data: {
        date: string
        endDate: string | null
        startTime: string
        endTime: string
        timezone: string
        recurring: boolean
        productIds: string[] | null
      }
      productTitles: string[]
    }>(
      `SELECT a.id::text AS id,u.name AS "providerName",u.email AS "providerEmail",
        p.write_calendar_id AS "calendarId",a.data,
        COALESCE((
          SELECT array_agg(COALESCE(NULLIF(product.data->'content'->'en'->>'title',''),product.data->'content'->'nl'->>'title',product.id) ORDER BY product.id)
          FROM products.product product
          WHERE product.store_id=a.store_id
            AND product.id=ANY(
              SELECT jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(a.data->'productIds')='array' THEN a.data->'productIds' ELSE '[]'::jsonb END
              )
            )
        ),'{}') AS "productTitles"
       FROM planning.availability a
       JOIN public."user" u ON u.id=a.user_id
       LEFT JOIN planning.provider p ON p.store_id=a.store_id AND p.user_id=a.user_id
       WHERE a.store_id=$1 AND a.id=ANY($2::uuid[])`,
      [store.organization_id, availabilityIds]
    )
    const byId = new Map(entities.map((entity) => [entity.id, entity]))
    for (const item of items) {
      if (item.kind !== 'availability' || !item.subject) {
        continue
      }
      const entity = byId.get(item.subject)
      if (!entity) {
        continue
      }
      item.subject = entity.providerName
      item.entity = {
        type: 'availability',
        id: entity.id,
        providerName: entity.providerName,
        providerEmail: entity.providerEmail,
        calendarId: entity.calendarId,
        date: entity.data.date,
        endDate: entity.data.endDate,
        startTime: entity.data.startTime,
        endTime: entity.data.endTime,
        timezone: entity.data.timezone,
        recurring: entity.data.recurring,
        allProducts: entity.data.productIds === null,
        productTitles: entity.productTitles
      }
    }
  }
  const total = count?.total || 0
  return {
    items,
    kinds: (
      await rows<{ kind: string }>(`${scopedJobs} SELECT DISTINCT kind FROM scoped WHERE store_id=$1 ORDER BY kind`, [
        store.organization_id
      ])
    ).map((row) => row.kind),
    pagination: { total, page: query.page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  }
})
