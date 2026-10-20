import { randomUUID } from 'node:crypto'
import { createError, setHeader, type H3Event } from 'h3'
import type { Order, OrderLine } from '../../shared/types'
import { downloadableLine, type PurchaseDownload } from '../../shared/downloads'
import { withFileExtension } from '../../shared/file-name'
import { rows } from './database'
import { baseUrl } from './access'
import { sendAsset } from './storage'

export async function orderDownloadToken(id: string) {
  const [row] = await rows<{ download_token: string }>('SELECT download_token FROM products.orders WHERE id=$1', [id])
  if (!row) {
    throw createError({ statusCode: 404 })
  }
  return row.download_token
}

export async function downloadOrder(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw createError({ statusCode: 404 })
  }
  const [order] = await rows<Order>('SELECT * FROM products.orders WHERE download_token=$1', [token])
  if (!order) {
    throw createError({ statusCode: 404 })
  }
  order.lines = await rows<OrderLine>('SELECT * FROM products.order_line WHERE order_id=$1 ORDER BY position', [
    order.id
  ])
  return order
}

export async function purchaseDownloads(order: Order, token: string): Promise<PurchaseDownload[]> {
  const ids = [...new Set(order.lines.flatMap((line) => line.snapshot.product.fileIds))].filter((id) =>
    downloadableLine(order, id)
  )
  if (!ids.length) {
    return []
  }
  const assets = await rows<{ id: string; name: string }>(
    'SELECT id,name FROM products.asset WHERE ready AND id=ANY($1::text[])',
    [ids]
  )
  return assets.map((asset) => ({
    id: asset.id,
    name: withFileExtension(
      downloadableLine(order, asset.id)!.snapshot.product.fileNames?.[asset.id]?.[order.snapshot.locale] || asset.name,
      asset.name
    ),
    url: `${baseUrl()}/api/store/purchases/${token}/files/${encodeURIComponent(asset.id)}`
  }))
}

export async function sendPurchasedAsset(
  event: H3Event,
  order: Order,
  assetId: string,
  source: 'public' | 'portal',
  attachment = true
) {
  const line = downloadableLine(order, assetId)
  if (!line) {
    throw createError({ statusCode: 404 })
  }
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  return sendAsset(
    event,
    assetId,
    attachment,
    line.snapshot.product.fileNames?.[assetId]?.[order.snapshot.locale],
    async () => {
      if (attachment && event.method === 'GET') {
        await rows('INSERT INTO products.download(id,order_id,order_line_id,asset_id,source) VALUES($1,$2,$3,$4,$5)', [
          randomUUID(),
          order.id,
          line.id,
          assetId,
          source
        ])
      }
    }
  )
}
