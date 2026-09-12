import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { z } from 'zod'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import type { Order } from '@nuxt-customer-portal/products/shared/types'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const q = parseInput(
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      search: z.string().max(200).default(''),
      status: z.enum(['pending', 'paid', 'failed', 'expired', 'all']).default('all'),
      sortBy: z.enum(['createdAt', 'total', 'email', 'bookingReference']).default('createdAt'),
      sortDir: z.enum(['asc', 'desc']).default('desc')
    }),
    getQuery(event)
  )
  const args = [organizationId, `%${q.search}%`, q.status]
  const where =
    "store_id=$1 AND (email ILIKE $2 OR booking_reference ILIKE $2 OR EXISTS(SELECT 1 FROM products.order_line l WHERE l.order_id=products.orders.id AND l.snapshot->>'title' ILIKE $2)) AND ($3='all' OR status=$3)"
  const [count] = await rows<{ count: string }>(`SELECT count(*) FROM products.orders WHERE ${where}`, args)
  const sortColumns = {
    createdAt: 'created_at',
    total: 'total',
    email: 'email',
    bookingReference: 'booking_reference'
  } as const
  const orderBy = sortColumns[q.sortBy]
  const direction = q.sortDir === 'asc' ? 'ASC' : 'DESC'
  const items = await rows<Order>(
    `SELECT * FROM products.orders WHERE ${where} ORDER BY ${orderBy} ${direction} NULLS LAST,id ${direction} LIMIT 20 OFFSET $4`,
    [...args, (q.page - 1) * 20]
  )
  for (const order of items) {
    order.lines = await rows('SELECT * FROM products.order_line WHERE order_id=$1 ORDER BY position', [order.id])
  }
  return {
    items,
    pagination: {
      page: q.page,
      pageSize: 20,
      totalItems: Number(count!.count),
      totalPages: Math.ceil(Number(count!.count) / 20)
    }
  }
})
