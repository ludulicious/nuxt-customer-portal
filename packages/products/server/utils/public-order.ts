import { orderPageCopy } from './page-texts'
import type { Order } from '../../shared/types'
import type { PublicOrderDetails } from '../../shared/public-order'
import { hasPurchaseAccess } from '../../shared/access'
import { localizedPurchaseLinks } from '../../shared/links'
import { withFileExtension } from '../../shared/file-name'
import { checkoutAppearanceSchema } from '../../shared/checkout-appearance'
import { rows } from './database'
import { getStore, baseUrl } from './access'

export async function publicOrderDetails(order: Order, token: string): Promise<PublicOrderDetails> {
  const store = await getStore()
  const access = hasPurchaseAccess(order)
  const fileIds = [
    ...new Set(
      order.lines
        .filter((line) => access && hasPurchaseAccess(order, line))
        .flatMap((line) => line.snapshot.product.fileIds)
    )
  ]
  const assets = fileIds.length
    ? await rows<{ id: string; name: string; content_type: string; size: number }>(
        'SELECT id,name,content_type,size FROM products.asset WHERE ready AND id=ANY($1::text[])',
        [fileIds]
      )
    : []
  return {
    copy: await orderPageCopy(order.store_id, order.snapshot.locale),
    reference: order.booking_reference,
    createdAt: order.created_at,
    locale: order.snapshot.locale,
    status: order.status,
    access,
    total: order.total,
    currency: order.lines[0]?.snapshot.price.currency || store.currencies[0] || 'EUR',
    appearance: checkoutAppearanceSchema.parse(
      store.organization_id === order.store_id ? store.checkout_appearance || {} : {}
    ),
    items: order.lines.map((line) => {
      const allowed = access && hasPurchaseAccess(order, line)
      const files = allowed
        ? line.snapshot.product.fileIds.flatMap((id) => {
            const asset = assets.find((asset) => asset.id === id)
            if (!asset) {
              return []
            }
            const url = `${baseUrl()}/api/store/purchases/${token}/files/${encodeURIComponent(id)}`
            return [
              {
                id,
                name: withFileExtension(
                  line.snapshot.product.fileNames?.[id]?.[order.snapshot.locale] || asset.name,
                  asset.name
                ),
                url,
                previewUrl: `${url}?preview=1`,
                content_type: asset.content_type,
                size: Number(asset.size)
              }
            ]
          })
        : []
      return {
        id: line.id,
        title: line.snapshot.title,
        quantity: line.quantity,
        amount: line.total,
        access: allowed,
        nextSteps: allowed ? line.snapshot.product.nextSteps[order.snapshot.locale] || '' : '',
        filesPending: allowed && files.length < line.snapshot.product.fileIds.length,
        files,
        links: allowed ? localizedPurchaseLinks(line.snapshot.product.links, order.snapshot.locale) : []
      }
    })
  }
}
