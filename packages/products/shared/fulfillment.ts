import { hasPurchaseAccess } from './access'
import type { Order, OrderLine, ProductData } from './types'

export const requiresFulfillment = (product: Pick<ProductData, 'requiresFulfillment'>) =>
  product.requiresFulfillment === true

export const canFulfillOrderLine = (
  order: Pick<Order, 'status' | 'total' | 'refunded' | 'disputed'>,
  line: Pick<OrderLine, 'fulfilled' | 'total' | 'refunded'> & {
    snapshot: { product: Pick<ProductData, 'requiresFulfillment'> }
  }
) =>
  requiresFulfillment(line.snapshot.product) &&
  !line.fulfilled &&
  hasPurchaseAccess(order) &&
  hasPurchaseAccess(order, line)
