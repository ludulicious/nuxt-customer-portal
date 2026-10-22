import { createError } from 'h3'
import type { AdminOrderDetails } from '../../shared/admin-order'
import { rows } from './database'
import { getOrder } from './orders'
import { publicOrderDetails } from './public-order'
import { orderDownloadToken } from './downloads'

export async function adminOrderDetails(organizationId: string, id: string): Promise<AdminOrderDetails> {
  const [owned] = await rows('SELECT id FROM products.orders WHERE id=$1 AND store_id=$2', [id, organizationId])
  if (!owned) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }
  const order = await getOrder(id)
  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }
  const [client] = order.client_id
    ? await rows<{ id: string; name: string }>('SELECT id,name FROM public.organization WHERE id=$1', [order.client_id])
    : []
  return {
    order,
    client: client || null,
    purchase: await publicOrderDetails(order, await orderDownloadToken(order.id))
  }
}
