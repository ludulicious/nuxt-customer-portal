import type { H3Event } from 'h3'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { appointmentListSchema } from '../../shared/validation'
import { appointmentScope } from './access'

export async function listAppointments(event: H3Event, input: unknown) {
  const scope = await appointmentScope(event),
    q = parseInput(appointmentListSchema, input)
  const values = [scope.storeId, scope.staff, scope.userId, `%${q.search}%`, q.status, q.conflicts, q.host]
  const where = `a.store_id=$1 AND ($2::boolean OR o.buyer_id=$3) AND ($4='%%' OR a.snapshot->>'title' ILIKE $4 OR u.name ILIKE $4 OR o.email ILIKE $4 OR o.snapshot->'billing'->>'name' ILIKE $4) AND ($5='all' OR a.status=$5) AND ($6='all' OR a.conflict) AND ($7='all' OR a.user_id=$7)`
  const from =
    'FROM planning.appointment a JOIN products.orders o ON o.id=a.order_id JOIN public."user" u ON u.id=a.user_id LEFT JOIN planning.provider p ON p.store_id=a.store_id AND p.user_id=a.user_id'
  const [count] = await rows<{ total: number }>(`SELECT count(*)::int AS total ${from} WHERE ${where}`, values)
  const total = count!.total,
    pageSize = 20,
    pageCount = Math.ceil(total / pageSize),
    page = Math.min(q.page, Math.max(1, pageCount))
  const sort = q.sortBy === 'title' ? "a.snapshot->>'title'" : 'a.start_at',
    direction = q.sortOrder === 'asc' ? 'ASC' : 'DESC'
  const items = await rows(
    `SELECT a.id,a.start_at AS start,a.end_at AS end,a.status,a.snapshot->>'title' AS title,a.snapshot->>'meetingProvider' AS "meetingProvider",a.meeting_url AS "meetingUrl",a.conflict,a.effects_error AS "effectsError",a.user_id AS "providerUserId",u.name AS "providerName",u.email AS "providerEmail",COALESCE(a.snapshot->>'timezone',p.timezone,u.timezone,'Europe/Amsterdam') AS "providerTimezone",a.snapshot->>'customerTimezone' AS "customerTimezone",o.email,o.snapshot->'billing'->>'name' AS "customerName",o.snapshot->'billing'->>'country' AS country ${from} WHERE ${where} ORDER BY ${sort} ${direction},a.id ${direction} LIMIT $8 OFFSET $9`,
    [...values, pageSize, (page - 1) * pageSize]
  )
  const hosts = scope.staff
    ? await rows<{ id: string; name: string }>(
        `SELECT DISTINCT u.id,u.name FROM planning.appointment a JOIN public."user" u ON u.id=a.user_id WHERE a.store_id=$1 ORDER BY u.name,u.id`,
        [scope.storeId]
      )
    : []
  return {
    items,
    pagination: { total, page, pageSize, pageCount },
    access: { staff: scope.staff, canManage: scope.canManage },
    hosts
  }
}
