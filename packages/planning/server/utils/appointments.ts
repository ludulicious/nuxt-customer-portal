import type { H3Event } from 'h3'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { appointmentListSchema } from '../../shared/validation'
import { appointmentScope } from './access'

export async function listAppointments(event: H3Event, input: unknown) {
  const scope = await appointmentScope(event),
    q = parseInput(appointmentListSchema, input)
  const values = [scope.storeId, scope.staff, scope.userId, `%${q.search}%`, q.status, q.conflicts]
  const where = `a.store_id=$1 AND ($2::boolean OR o.buyer_id=$3) AND ($4='%%' OR a.snapshot->>'title' ILIKE $4 OR u.name ILIKE $4 OR o.email ILIKE $4) AND ($5='all' OR a.status=$5) AND ($6='all' OR a.conflict)`
  const from =
    'FROM planning.appointment a JOIN products.orders o ON o.id=a.order_id JOIN public."user" u ON u.id=a.user_id'
  const [count] = await rows<{ total: number }>(`SELECT count(*)::int AS total ${from} WHERE ${where}`, values)
  const total = count!.total,
    pageSize = 20,
    pageCount = Math.ceil(total / pageSize),
    page = Math.min(q.page, Math.max(1, pageCount))
  const sort = q.sortBy === 'title' ? "a.snapshot->>'title'" : 'a.start_at',
    direction = q.sortOrder === 'asc' ? 'ASC' : 'DESC'
  const items = await rows(
    `SELECT a.id,a.start_at AS start,a.end_at AS end,a.status,a.snapshot->>'title' AS title,a.conflict,a.effects_error AS "effectsError",u.name AS "providerName",a.snapshot->>'customerTimezone' AS "customerTimezone",o.email ${from} WHERE ${where} ORDER BY ${sort} ${direction},a.id ${direction} LIMIT $7 OFFSET $8`,
    [...values, pageSize, (page - 1) * pageSize]
  )
  return {
    items,
    pagination: { total, page, pageSize, pageCount },
    access: { staff: scope.staff, canManage: scope.canManage }
  }
}
