import { z } from 'zod'
import { admin } from '../../../../utils/access'
import { getProduct, publicProduct } from '../../../../utils/catalog'
import { parseInput } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const query = parseInput(
    z.object({ slug: z.string().trim().min(1).max(200), locale: z.enum(['en', 'nl']) }),
    getQuery(event)
  )
  const product = await getProduct(organizationId, query.slug, true)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return publicProduct(product, query.locale)
})
