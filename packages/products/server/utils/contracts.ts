import type { PoolClient } from 'pg'
import type { Order } from '../../shared/types'

export interface PurchaseIntegration {
  assertReady(storeId: string): Promise<void>
  invoice(client: PoolClient, order: Order, actorId: string): Promise<string>
  refund(client: PoolClient, order: Order, actorId: string): Promise<void>
  notify(order: Order, actorId: string): Promise<void>
}
let integration: PurchaseIntegration | undefined
export const registerPurchaseIntegration = (value: PurchaseIntegration) => {
  integration = value
}
export const purchaseIntegration = () => {
  if (!integration) {
    throw new Error('Install and enable invoice-products before opening checkout')
  }
  return integration
}
export type FulfillmentHook = (client: PoolClient, order: Order) => Promise<void>
const hooks: FulfillmentHook[] = []
/** Hooks run within the paid-order transaction and must be idempotent by order ID. */
export const registerPurchaseFulfillmentHook = (hook: FulfillmentHook) => {
  hooks.push(hook)
}
export const runPurchaseFulfillmentHooks = async (client: PoolClient, order: Order) => {
  for (const hook of hooks) {
    await hook(client, order)
  }
}
