import type { PoolClient } from 'pg'
import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import sharp from 'sharp'
import { rows, transaction } from './database'
import { parseInput } from './validation'
import { mediaObjectStorage } from './media-storage'
import { mediaMaximum } from '../../shared/media'
import {
  defaultMediaVariantPresets,
  mediaVariantSettingsSchema,
  type MediaVariantConfiguration,
  type MediaVariantPreset
} from '../../shared/media-variants'

export interface MediaFileRow {
  id: string
  store_id: string
  upload_id: string
  role: string
  variant_key: string | null
  name: string
  content_type: string
  size: string
  width: number
  height: number
  object_key: string
  ready: boolean
}
export interface MediaVariantRow {
  store_id: string
  media_id: string
  key: string
  label: string
  mode: 'automatic' | 'custom'
  width: number
  height: number
  file_id: string
  source_file_id: string
}
export const lockMediaStore = (client: PoolClient, storeId: string) =>
  client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`products.media:${storeId}`])
export async function mediaVariantConfiguration(
  storeId: string,
  client?: PoolClient
): Promise<MediaVariantConfiguration> {
  const [store] = await rows<{ media_variants: MediaVariantPreset[]; media_variants_revision: number }>(
    'SELECT media_variants,media_variants_revision FROM products.store WHERE organization_id=$1',
    [storeId],
    client
  )
  return {
    presets: store?.media_variants || defaultMediaVariantPresets(),
    revision: store?.media_variants_revision || 1
  }
}
export async function saveMediaVariantConfiguration(storeId: string, input: unknown) {
  const data = parseInput(mediaVariantSettingsSchema, input)
  return transaction(async (client) => {
    await lockMediaStore(client, storeId)
    const result = await rows(
      'UPDATE products.store SET media_variants=$2,media_variants_revision=media_variants_revision+1 WHERE organization_id=$1 AND media_variants_revision=$3 RETURNING id',
      [storeId, JSON.stringify(data.presets), data.revision],
      client
    )
    if (!result.length) {
      throw createError({ statusCode: 409, message: 'Variant settings have changed. Reload before saving.' })
    }
    return mediaVariantConfiguration(storeId, client)
  })
}
export async function renderMediaVariant(body: Buffer, sourceType: string, preset: MediaVariantPreset) {
  const contentType = sourceType === 'image/gif' ? 'image/gif' : 'image/webp'
  const metadata = await sharp(body, { animated: true, limitInputPixels: 40_000_000 }).metadata()
  if (preset.width * preset.height * (metadata.pages || 1) > 40_000_000) {
    throw createError({ statusCode: 422, message: 'Generated image variant exceeds the pixel limit' })
  }
  const pipeline = sharp(body, { animated: true, limitInputPixels: 40_000_000 })
    .rotate()
    .resize(preset.width, preset.height, { fit: 'cover', position: 'centre' })
  const output = await (contentType === 'image/gif' ? pipeline.gif() : pipeline.webp({ quality: 88 })).toBuffer()
  if (output.length > mediaMaximum) {
    throw createError({ statusCode: 422, message: 'Generated image variant exceeds the size limit' })
  }
  return { body: output, contentType }
}
export async function reconcileMediaVariants(
  storeId: string,
  mediaId: string,
  imageId: string,
  originalChanged: boolean,
  uploads: MediaFileRow[],
  resets: string[],
  config: MediaVariantConfiguration,
  client: PoolClient
) {
  const previous = await rows<MediaVariantRow>(
    'SELECT * FROM products.media_variant WHERE store_id=$1 AND media_id=$2',
    [storeId, mediaId],
    client
  )
  const customFiles = uploads.filter((file) => file.role === 'variant' || file.role === 'thumbnail')
  const configuredKeys = new Set(config.presets.map((preset) => preset.key))
  if (
    [...resets, ...customFiles.map((file) => file.variant_key || 'thumbnail')].some((key) => !configuredKeys.has(key))
  ) {
    throw createError({ statusCode: 400, message: 'Unknown media variant' })
  }
  const [image] = await rows<MediaFileRow>(
    'SELECT * FROM products.media_file WHERE store_id=$1 AND id=$2 AND ready',
    [storeId, imageId],
    client
  )
  if (!image) {
    throw createError({ statusCode: 409, message: 'Image is not ready' })
  }
  if (image.content_type === 'image/gif' && customFiles.length) {
    throw createError({ statusCode: 400, message: 'GIF variants are generated automatically' })
  }
  let generatedUpload: string | undefined
  let storage: Awaited<ReturnType<typeof mediaObjectStorage>> | undefined
  const sourceCache = new Map<string, Buffer>()
  for (const preset of config.presets) {
    const old = previous.find((variant) => variant.key === preset.key)
    const uploaded = customFiles.find((file) => (file.variant_key || 'thumbnail') === preset.key)
    const retainCustom = !originalChanged && old?.mode === 'custom' && !resets.includes(preset.key)
    const mode = uploaded || retainCustom ? 'custom' : 'automatic'
    const sourceId = uploaded?.id || (retainCustom ? old!.source_file_id : imageId)
    let fileId = old?.file_id
    if (
      !old ||
      old.source_file_id !== sourceId ||
      old.width !== preset.width ||
      old.height !== preset.height ||
      old.mode !== mode
    ) {
      storage ||= await mediaObjectStorage()
      const [source] = await rows<MediaFileRow>(
        'SELECT * FROM products.media_file WHERE store_id=$1 AND id=$2 AND ready',
        [storeId, sourceId],
        client
      )
      if (!source) {
        throw createError({ statusCode: 409, message: 'Variant source is not ready' })
      }
      if (!sourceCache.has(sourceId)) {
        sourceCache.set(sourceId, await storage.get(source.object_key))
      }
      const rendered = await renderMediaVariant(sourceCache.get(sourceId)!, source.content_type, preset)
      if (!generatedUpload) {
        generatedUpload = randomUUID()
        // Durable staging records survive a failed media transaction so cleanup can retry.
        await rows('INSERT INTO products.media_upload(id,store_id) VALUES($1,$2)', [generatedUpload, storeId])
      }
      fileId = randomUUID()
      const extension = rendered.contentType === 'image/gif' ? 'gif' : 'webp'
      const key = `products/media/${storeId}/${generatedUpload}/${fileId}.${extension}`
      await rows(
        `INSERT INTO products.media_file(id,store_id,upload_id,role,variant_key,name,content_type,size,object_key) VALUES($1,$2,$3,'rendition',$4,$5,$6,$7,$8)`,
        [
          fileId,
          storeId,
          generatedUpload,
          preset.key,
          `${preset.key}.${extension}`,
          rendered.contentType,
          rendered.body.length,
          key
        ]
      )
      await storage.put(key, rendered.body, rendered.contentType)
      await rows('UPDATE products.media_file SET ready=true,width=$2,height=$3 WHERE id=$1', [
        fileId,
        preset.width,
        preset.height
      ])
    }
    await rows(
      `INSERT INTO products.media_variant(store_id,media_id,key,label,mode,width,height,file_id,source_file_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(store_id,media_id,key) DO UPDATE SET label=$4,mode=$5,width=$6,height=$7,file_id=$8,source_file_id=$9`,
      [storeId, mediaId, preset.key, preset.label, mode, preset.width, preset.height, fileId, sourceId],
      client
    )
  }
  await rows(
    'DELETE FROM products.media_variant WHERE store_id=$1 AND media_id=$2 AND NOT(key=ANY($3::text[]))',
    [storeId, mediaId, [...configuredKeys]],
    client
  )
  await rows(
    "UPDATE products.media m SET thumbnail_file_id=v.file_id FROM products.media_variant v WHERE m.id=$1 AND m.store_id=$2 AND v.media_id=m.id AND v.store_id=m.store_id AND v.key='thumbnail'",
    [mediaId, storeId],
    client
  )
  if (generatedUpload) {
    await rows('UPDATE products.media_upload SET committed_media_id=$2 WHERE id=$1', [generatedUpload, mediaId], client)
  }
}
