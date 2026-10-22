import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { adminOrderDetails } from '@nuxt-customer-portal/products/server/utils/admin-order'
import type { AdminOrderDetails } from '@nuxt-customer-portal/products/shared/admin-order'

export default defineEventHandler(async (event): Promise<AdminOrderDetails> => {
  const { organizationId } = await admin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  return adminOrderDetails(organizationId, getRouterParam(event, 'id')!)
})
