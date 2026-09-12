import { claimPurchases, hasAccess, getOrder } from '@nuxt-customer-portal/products/server/utils/orders'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import type { Order } from '@nuxt-customer-portal/products/shared/types'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const userId = await claimPurchases(event)
  setHeader(event, 'Cache-Control', 'no-store')
  const query = parseInput(
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      search: z.string().max(200).default(''),
      type: z.enum(['all', 'service', 'digital']).default('all'),
      access: z.enum(['all', 'available', 'revoked']).default('all'),
      sortBy: z.enum(['createdAt', 'title', 'amount']).default('createdAt'),
      sortDir: z.enum(['asc', 'desc']).default('desc')
    }),
    getQuery(event)
  )
  const args = [userId, `%${query.search}%`, query.type, query.access]
  const where = `o.buyer_id=$1 AND o.status='paid'
    AND l.snapshot->>'title' ILIKE $2
    AND ($3='all' OR l.snapshot->'product'->>'type'=$3)
    AND ($4='all' OR ($4='available')=(o.total IS NOT NULL AND NOT o.disputed AND (l.total IS NULL OR l.total=0 OR l.refunded<l.total)))`
  const [count] = await rows<{ count: string }>(
    `SELECT count(*) FROM products.order_line l JOIN products.orders o ON o.id=l.order_id WHERE ${where}`,
    args
  )
  const sortColumns = {
    createdAt: 'o.created_at',
    title: `l.snapshot->>'title'`,
    amount: 'COALESCE(l.total,l.unit_amount*l.quantity)'
  } as const
  const direction = query.sortDir === 'asc' ? 'ASC' : 'DESC'
  const selected = await rows<{ id: string; order_id: string }>(
    `SELECT l.id,l.order_id FROM products.order_line l JOIN products.orders o ON o.id=l.order_id
     WHERE ${where} ORDER BY ${sortColumns[query.sortBy]} ${direction},l.id ${direction} LIMIT 20 OFFSET $5`,
    [...args, (query.page - 1) * 20]
  )
  const orders = new Map<string, Order>()
  for (const orderId of new Set(selected.map((item) => item.order_id))) {
    const order = await getOrder(orderId)
    if (order) {
      orders.set(orderId, order)
    }
  }
  const items = selected.flatMap((item) => {
    const order = orders.get(item.order_id)
    const line = order?.lines.find((candidate) => candidate.id === item.id)
    if (!order || !line) {
      return []
    }
    return [
      {
        id: line.id,
        orderId: order.id,
        bookingReference: order.booking_reference,
        title: line.snapshot.title,
        locale: order.snapshot.locale,
        type: line.snapshot.product.type,
        amount: line.total ?? line.unit_amount * line.quantity,
        currency: line.snapshot.price.currency,
        access: hasAccess(order, line),
        refunded: line.refunded,
        disputed: order.disputed,
        fulfilled: line.fulfilled,
        invoiceId: order.invoice_id,
        nextSteps: line.snapshot.product.nextSteps[order.snapshot.locale],
        fileIds: hasAccess(order, line) ? line.snapshot.product.fileIds : [],
        createdAt: order.created_at
      }
    ]
  })
  const totalItems = Number(count!.count)
  return { items, pagination: { page: query.page, pageSize: 20, totalItems, totalPages: Math.ceil(totalItems / 20) } }
})
