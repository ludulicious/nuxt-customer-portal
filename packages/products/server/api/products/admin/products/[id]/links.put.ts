import { admin } from '@nuxt-customer-portal/products/server/utils/access'
import { saveProductLinks } from '@nuxt-customer-portal/products/server/utils/catalog'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { purchasedLinksSchema } from '../../../../../../shared/links'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const { links } = parseInput(z.object({ links: purchasedLinksSchema }), await readBody(event))
  return saveProductLinks(organizationId, getRouterParam(event, 'id')!, links)
})
