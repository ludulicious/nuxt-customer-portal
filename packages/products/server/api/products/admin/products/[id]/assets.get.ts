import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { getProduct } from '@nuxt-customer-portal/products/server/utils/catalog'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const id = getRouterParam(event, 'id')!
  await getProduct(organizationId, id)
  return rows(
    'SELECT id,product_id,name,content_type,size,visibility,ready,status,width,height,failure_reason,image_purpose FROM products.asset WHERE product_id=$1 ORDER BY name',
    [id]
  )
})
