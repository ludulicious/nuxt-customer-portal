import { z } from 'zod'
import { admin, getStore } from '../../../../utils/access'
import { getProduct, selectCopy } from '../../../../utils/catalog'
import { rows } from '../../../../utils/database'
import { orderPageCopy } from '../../../../utils/page-texts'
import { parseInput } from '../../../../utils/validation'
import { localizedPurchaseLinks } from '../../../../../shared/links'
import { withFileExtension } from '../../../../../shared/file-name'
import { purchaseAppearance, purchaseThumbnail } from '../../../../utils/purchase-appearance'
import type { PublicOrderDetails } from '../../../../../shared/public-order'

export default defineEventHandler(async (event): Promise<PublicOrderDetails> => {
  const { organizationId } = await admin(event)
  const { slug, locale } = parseInput(
    z.object({ slug: z.string().trim().min(1).max(200), locale: z.enum(['en', 'nl']) }),
    getQuery(event)
  )
  setHeader(event, 'Cache-Control', 'private, no-store')
  const product = await getProduct(organizationId, slug, true)
  const store = await getStore()
  const assets = product.fileIds.length
    ? await rows<{ id: string; name: string; content_type: string; size: number }>(
        'SELECT id,name,content_type,size FROM products.asset WHERE ready AND id=ANY($1::text[]) AND product_id=$2',
        [product.fileIds, product.id]
      )
    : []
  return {
    copy: await orderPageCopy(organizationId, locale, product.slug),
    reference: 'BK-PREVIEW',
    createdAt: new Date().toISOString(),
    locale,
    status: 'paid',
    access: true,
    total: product.isFree ? 0 : (product.prices[0]?.amount ?? null),
    currency: product.prices[0]?.currency || store.currencies[0] || 'EUR',
    appearance: await purchaseAppearance(organizationId, store.checkout_appearance),
    items: [
      {
        id: product.id,
        title: selectCopy(product, locale, store.default_locale).title,
        thumbnailImage: await purchaseThumbnail(product, organizationId),
        quantity: 1,
        amount: product.isFree ? 0 : (product.prices[0]?.amount ?? null),
        access: true,
        nextSteps: product.nextSteps[locale] || '',
        filesPending: assets.length < product.fileIds.length,
        files: product.fileIds.flatMap((id) => {
          const asset = assets.find((item) => item.id === id)
          return asset
            ? [
                {
                  id,
                  name: withFileExtension(product.fileNames[id]?.[locale] || asset.name, asset.name),
                  url: '#',
                  previewUrl: '#',
                  content_type: asset.content_type,
                  size: Number(asset.size)
                }
              ]
            : []
        }),
        links: localizedPurchaseLinks(product.links, locale)
      }
    ]
  }
})
