import { z } from 'zod'
import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct } from '@nuxt-customer-portal/products/server/utils/catalog'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { sendAsset } from '@nuxt-customer-portal/products/server/utils/storage'

const querySchema = z.object({
  download: z.literal('1').optional(),
  name: z.string().trim().min(1).max(200).optional()
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const product = await getProduct(organizationId, getRouterParam(event, 'id')!)
  const id = getRouterParam(event, 'assetId')!
  const [asset] = await rows(
    "SELECT id FROM products.asset WHERE id=$1 AND product_id=$2 AND visibility='private' AND ready",
    [id, product.id]
  )
  if (!asset) {
    throw createError({ statusCode: 404 })
  }
  const query = querySchema.parse(getQuery(event))
  setHeader(event, 'Cache-Control', 'private, no-store')
  return sendAsset(event, id, query.download === '1', query.name)
})
