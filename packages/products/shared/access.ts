import type { Order } from './types'

export const hasPurchaseAccess = (order: Pick<Order, 'status' | 'total' | 'refunded' | 'disputed'>) =>
  order.status === 'paid' &&
  order.total !== null &&
  (order.total === 0 || order.refunded < order.total) &&
  !order.disputed
