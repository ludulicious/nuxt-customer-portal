import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { rows, transaction } from './database'
import { lockMediaStore, mediaVariantConfiguration } from './media-variants'
import { mediaContent } from './media'
import { parseInput } from './validation'
import { productMediaSchema } from '../../shared/product-media'
import type { Asset } from '../../shared/types'

export async function linkProductMedia(storeId: string, productId: string, input: unknown): Promise<Asset> {
  const data = parseInput(productMediaSchema, input)
  return transaction(async (client) => {
    await lockMediaStore(client, storeId)
    const [product] = await rows(
      'SELECT id FROM products.product WHERE id=$1 AND store_id=$2',
      [productId, storeId],
      client
    )
    if (!product) {
      throw createError({ statusCode: 404, message: 'Product not found' })
    }
    const [media] = await rows(
      `SELECT m.title,m.alt,f.content_type,f.size,f.width,f.height FROM products.media m
       LEFT JOIN products.media_variant v ON v.media_id=m.id AND v.store_id=m.store_id AND v.key=$3
       JOIN products.media_file f ON f.id=CASE WHEN $3='image' THEN m.image_file_id ELSE v.file_id END AND f.store_id=m.store_id AND f.ready
       WHERE m.id=$1 AND m.store_id=$2 AND m.visible`,
      [data.mediaId, storeId, data.variant],
      client
    )
    if (!media) {
      throw createError({ statusCode: 400, message: 'Choose a visible library image with an available variant' })
    }
    const config = await mediaVariantConfiguration(storeId, client)
    if (data.variant !== 'image' && !config.presets.some((preset) => preset.key === data.variant)) {
      throw createError({ statusCode: 400, message: 'The selected variant was removed from store settings' })
    }
    const id = randomUUID()
    const [asset] = await rows<Asset>(
      `INSERT INTO products.asset(id,product_id,name,content_type,size,visibility,object_key,ready,status,width,height,image_purpose,media_id,media_variant)
       VALUES($1,$2,$3,$4,$5,'public',$6,true,'ready',$7,$8,$9,$10,$11)
       ON CONFLICT(product_id,media_id,image_purpose,media_variant) WHERE media_id IS NOT NULL DO UPDATE SET name=EXCLUDED.name,content_type=EXCLUDED.content_type,size=EXCLUDED.size,width=EXCLUDED.width,height=EXCLUDED.height
       RETURNING id,product_id,name,content_type,size,visibility,ready,status,width,height,image_purpose,media_id,media_variant`,
      [
        id,
        productId,
        media.title,
        media.content_type,
        media.size,
        `media-link:${id}`,
        media.width,
        media.height,
        data.purpose,
        data.mediaId,
        data.variant
      ],
      client
    )
    return { ...asset!, alternative_text: media.alt }
  })
}

export async function productMediaContent(assetId: string, manage = false) {
  const [asset] = await rows<{ media_id: string; media_variant: string; store_id: string }>(
    `SELECT a.media_id,a.media_variant,p.store_id FROM products.asset a JOIN products.product p ON p.id=a.product_id
     WHERE a.id=$1 AND a.ready AND a.visibility='public' AND a.media_id IS NOT NULL`,
    [assetId]
  )
  if (!asset) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }
  return mediaContent(asset.store_id, asset.media_id, manage, asset.media_variant)
}

export async function productAssets(productId: string): Promise<Asset[]> {
  return rows<Asset>(
    `SELECT a.id,a.product_id,coalesce(m.title,a.name) AS name,coalesce(f.content_type,a.content_type) AS content_type,
     coalesce(f.size,a.size) AS size,a.visibility,a.ready,a.status,coalesce(f.width,a.width) AS width,coalesce(f.height,a.height) AS height,
     a.failure_reason,a.image_purpose,a.media_id,a.media_variant,m.alt AS alternative_text
     FROM products.asset a LEFT JOIN products.product p ON p.id=a.product_id
     LEFT JOIN products.media m ON m.id=a.media_id AND m.store_id=p.store_id
     LEFT JOIN products.media_variant v ON v.media_id=m.id AND v.store_id=m.store_id AND v.key=a.media_variant
     LEFT JOIN products.media_file f ON f.id=CASE WHEN a.media_variant='image' THEN m.image_file_id ELSE v.file_id END AND f.store_id=m.store_id
     WHERE a.product_id=$1 ORDER BY a.name,a.id`,
    [productId]
  )
}
