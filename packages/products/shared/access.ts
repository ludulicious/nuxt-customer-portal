import type { Order, OrderLine } from './types'

export const hasPurchaseAccess = (
  order: Pick<Order, 'status' | 'total' | 'refunded' | 'disputed'>,
  line?: Pick<OrderLine, 'total' | 'refunded'>
) =>
  ['paid', 'accepted'].includes(order.status) &&
  order.total !== null &&
  (line
    ? line.total === 0 || line.total === null || line.refunded < line.total
    : order.total === 0 || order.refunded < order.total) &&
  !order.disputed
