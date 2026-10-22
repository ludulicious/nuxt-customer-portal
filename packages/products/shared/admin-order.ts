import type { Order } from './types'
import type { PublicOrderDetails } from './public-order'

export interface AdminOrderDetails {
  order: Order
  client: { id: string; name: string } | null
  purchase: PublicOrderDetails
}
