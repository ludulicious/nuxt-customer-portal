import { admin, getStore } from '@nuxt-customer-portal/products/server/utils/access'
import { getProduct, selectCopy, renderDescription } from '@nuxt-customer-portal/products/server/utils/catalog'
import type { ProductPreview } from '@nuxt-customer-portal/products/shared/types'

export default defineEventHandler(async (event): Promise<ProductPreview> => {
  const { organizationId } = await admin(event)
  const product = await getProduct(organizationId, getRouterParam(event, 'id')!)
  const store = await getStore()
  const content = Object.fromEntries(
    (['en', 'nl'] as const).map((locale) => {
      const copy = selectCopy(product, locale, store.default_locale)
      return [
        locale,
        { title: copy.title, summary: copy.summary, descriptionHtml: renderDescription(copy.description) }
      ]
    })
  ) as ProductPreview['content']
  setHeader(event, 'Cache-Control', 'no-store')
  return {
    product,
    content,
    languages: store.languages,
    currencies: store.currencies,
    defaultLocale: store.default_locale
  }
})
