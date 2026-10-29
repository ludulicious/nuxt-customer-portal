import { mediaVariantConfiguration, reconcileMediaVariants, type MediaVariantRow } from './media-variants'
import type { MediaVariantConfiguration } from '../../shared/media-variants'
import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { PoolClient } from 'pg'
import { rows, transaction } from './database'
import { parseInput } from './validation'
import { mediaObjectStorage, validateMediaImage } from './media-storage'
import {
  mediaContentUrl,
  mediaListSchema,
  mediaUploadSchema,
  mediaSaveSchema,
  mediaReorderSchema,
  type MediaFile,
  type MediaPage,
  type StoreMedia,
  type MediaUpload
} from '../../shared/media'

interface FileRow {
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
interface MediaRow {
  id: string
  store_id: string
  title: string
  alt: string
  categories: string[]
  credit: string
  visible: boolean
  position: number
  revision: number
  original_file_id: string
  image_file_id: string
  thumbnail_file_id: string | null
  created_at: string
  updated_at: string
}
const notFound = () => createError({ statusCode: 404, message: 'Image not found' })
const conflict = () => createError({ statusCode: 409, message: 'This image has changed. Reload before saving.' })
const lockStore = (client: PoolClient, storeId: string) =>
  client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`products.media:${storeId}`])
async function dto(
  row: MediaRow,
  manage: boolean,
  client?: PoolClient,
  configuration?: MediaVariantConfiguration
): Promise<StoreMedia> {
  const config = configuration || (await mediaVariantConfiguration(row.store_id, client))
  const variants = await rows<MediaVariantRow>(
    'SELECT * FROM products.media_variant WHERE store_id=$1 AND media_id=$2 ORDER BY key',
    [row.store_id, row.id],
    client
  )
  const ids = [
    row.image_file_id,
    row.thumbnail_file_id,
    ...(manage ? [row.original_file_id] : []),
    ...variants.flatMap((variant) => [variant.file_id, ...(manage ? [variant.source_file_id] : [])])
  ].filter(Boolean)
  const files = await rows<FileRow>(
    'SELECT * FROM products.media_file WHERE store_id=$1 AND id=ANY($2::text[]) AND ready',
    [row.store_id, ids],
    client
  )
  const file = (id: string | null, variant: string, source = false): MediaFile | undefined => {
    const value = files.find((item) => item.id === id)
    return value
      ? {
          name: value.name,
          contentType: value.content_type,
          size: Number(value.size),
          width: value.width,
          height: value.height,
          url: mediaContentUrl(row.id, variant, value.id, source)
        }
      : undefined
  }
  return {
    id: row.id,
    title: row.title,
    alt: row.alt,
    categories: row.categories,
    credit: row.credit,
    visible: row.visible,
    order: row.position,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    image: file(row.image_file_id, 'image')!,
    thumbnail: file(
      variants.find((variant) => variant.key === 'thumbnail')?.file_id || row.thumbnail_file_id,
      'thumbnail'
    ),
    ...(manage ? { original: file(row.original_file_id, 'original') } : {}),
    variants: Object.fromEntries(
      variants.map((variant) => [
        variant.key,
        {
          key: variant.key,
          label: variant.label,
          mode: variant.mode,
          width: variant.width,
          height: variant.height,
          file: file(variant.file_id, variant.key)!,
          ...(manage ? { source: file(variant.source_file_id, variant.key, true) } : {})
        }
      ])
    ),
    variantsOutdated:
      variants.length !== config.presets.length ||
      config.presets.some((preset) => {
        const variant = variants.find((item) => item.key === preset.key)
        return (
          !variant ||
          variant.width !== preset.width ||
          variant.height !== preset.height ||
          variant.label !== preset.label
        )
      })
  }
}
export async function getMedia(storeId: string, id: string, manage: boolean, client?: PoolClient): Promise<StoreMedia> {
  const [row] = await rows<MediaRow>(
    'SELECT * FROM products.media WHERE store_id=$1 AND id=$2 AND ($3::boolean OR visible)',
    [storeId, id, manage],
    client
  )
  if (!row) {
    throw notFound()
  }
  return dto(row, manage, client)
}
export async function listMedia(storeId: string, manage: boolean, input: unknown): Promise<MediaPage> {
  const query = parseInput(mediaListSchema, input)
  const values = [storeId, manage, query.search, query.category, query.visibility]
  const where = `store_id=$1 AND ($2::boolean OR visible) AND ($3='' OR strpos(lower(title || ' ' || alt || ' ' || credit),lower($3))>0) AND ($4='' OR $4=ANY(categories)) AND ($5='all' OR visible=($5='visible'))`
  const [count] = await rows<{ total: string }>(`SELECT count(*) AS total FROM products.media WHERE ${where}`, values)
  const total = Number(count!.total),
    pageCount = Math.ceil(total / 20),
    page = Math.min(query.page, Math.max(1, pageCount))
  const sort = { order: 'position', title: 'lower(title)', created: 'created_at' }[query.sortBy]
  const result = await rows<MediaRow>(
    `SELECT * FROM products.media WHERE ${where} ORDER BY ${sort} ${query.sortDir === 'desc' ? 'DESC' : 'ASC'},id LIMIT 20 OFFSET $6`,
    [...values, (page - 1) * 20]
  )
  const categories = await rows<{ category: string }>(
    'SELECT DISTINCT unnest(categories) AS category FROM products.media WHERE store_id=$1 AND ($2::boolean OR visible) ORDER BY category',
    [storeId, manage]
  )
  const configuration = await mediaVariantConfiguration(storeId)
  return {
    items: await Promise.all(result.map((row) => dto(row, manage, undefined, configuration))),
    categories: categories.map((row) => row.category),
    pagination: { total, page, pageSize: 20, pageCount }
  }
}
export async function startMediaUpload(storeId: string, input: unknown): Promise<MediaUpload> {
  const data = parseInput(mediaUploadSchema, input),
    id = randomUUID()
  return transaction(async (client) => {
    await rows('INSERT INTO products.media_upload(id,store_id) VALUES($1,$2)', [id, storeId], client)
    const files = []
    for (const file of data.files) {
      const fileId = randomUUID(),
        extension = file.contentType === 'image/jpeg' ? 'jpg' : file.contentType.slice(6)
      const key = `products/media/${storeId}/${id}/${fileId}.${extension}`
      await rows(
        'INSERT INTO products.media_file(id,store_id,upload_id,role,name,content_type,size,object_key,variant_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [fileId, storeId, id, file.role, file.name, file.contentType, file.size, key, file.key || null],
        client
      )
      files.push({ id: fileId, role: file.role, key: file.key, url: `/api/products/media/uploads/${id}/${fileId}` })
    }
    return { id, files }
  })
}
export async function putMediaUpload(storeId: string, uploadId: string, fileId: string, body: Buffer) {
  return transaction(async (client) => {
    const [upload] = await rows(
      'SELECT id FROM products.media_upload WHERE store_id=$1 AND id=$2 AND committed_media_id IS NULL FOR UPDATE',
      [storeId, uploadId],
      client
    )
    if (!upload) {
      throw notFound()
    }
    const [file] = await rows<FileRow>(
      'SELECT * FROM products.media_file WHERE store_id=$1 AND upload_id=$2 AND id=$3',
      [storeId, uploadId, fileId],
      client
    )
    if (!file) {
      throw notFound()
    }
    if (file.ready) {
      return { uploaded: true }
    }
    if (Number(file.size) !== body.length) {
      throw createError({ statusCode: 400, message: 'Upload size does not match' })
    }
    const dimensions = await validateMediaImage(body, file.content_type)
    const storage = await mediaObjectStorage()
    await storage.put(file.object_key, body, file.content_type)
    await rows(
      'UPDATE products.media_file SET ready=true,width=$2,height=$3 WHERE id=$1',
      [file.id, dimensions.width, dimensions.height],
      client
    )
    return { uploaded: true }
  })
}
export async function saveMedia(storeId: string, input: unknown): Promise<StoreMedia> {
  const data = parseInput(mediaSaveSchema, input)
  return transaction(async (client) => {
    await lockStore(client, storeId)
    let files: FileRow[] = []
    if (data.uploadId) {
      const [upload] = await rows<{ committed_media_id: string | null }>(
        'SELECT committed_media_id FROM products.media_upload WHERE store_id=$1 AND id=$2 FOR UPDATE',
        [storeId, data.uploadId],
        client
      )
      if (!upload) {
        throw notFound()
      }
      if (upload.committed_media_id) {
        if (data.id && data.id !== upload.committed_media_id) {
          throw conflict()
        }
        return getMedia(storeId, upload.committed_media_id, true, client)
      }
      files = await rows<FileRow>(
        'SELECT * FROM products.media_file WHERE store_id=$1 AND upload_id=$2',
        [storeId, data.uploadId],
        client
      )
      if (!files.length || files.some((file) => !file.ready)) {
        throw createError({ statusCode: 409, message: 'Finish uploading every image file before saving' })
      }
    }
    const configuration = await mediaVariantConfiguration(storeId, client)
    if (data.presetRevision && data.presetRevision !== configuration.revision) {
      throw createError({ statusCode: 409, message: 'Variant settings have changed. Reload before saving.' })
    }
    const original = files.find((file) => file.role === 'original'),
      image = files.find((file) => file.role === 'image'),
      thumbnail = files.find((file) => file.role === 'thumbnail')
    if (thumbnail?.content_type === 'image/gif' || (original?.content_type === 'image/gif' && (image || thumbnail))) {
      throw createError({ statusCode: 400, message: 'GIF images do not support separate thumbnail crops' })
    }
    const id = data.id || randomUUID()
    const metadata = [data.title, data.alt, data.categories, data.credit, data.visible]
    if (data.id) {
      const [previous] = await rows<MediaRow>(
        'SELECT * FROM products.media WHERE store_id=$1 AND id=$2 FOR UPDATE',
        [storeId, id],
        client
      )
      if (!previous) {
        throw notFound()
      }
      if (!original && (image || thumbnail)) {
        const [source] = await rows<FileRow>(
          'SELECT * FROM products.media_file WHERE store_id=$1 AND id=$2',
          [storeId, previous.original_file_id],
          client
        )
        if (source?.content_type === 'image/gif') {
          throw createError({ statusCode: 400, message: 'Replace the GIF source to change its image' })
        }
      }
      if (previous.revision !== data.revision) {
        throw conflict()
      }
      await rows(
        `UPDATE products.media SET title=$3,alt=$4,categories=$5,credit=$6,visible=$7,original_file_id=$8,image_file_id=$9,thumbnail_file_id=$10,revision=revision+1,updated_at=now() WHERE store_id=$1 AND id=$2`,
        [
          storeId,
          id,
          ...metadata,
          original?.id || previous.original_file_id,
          image?.id || original?.id || previous.image_file_id,
          thumbnail?.id || (original ? null : previous.thumbnail_file_id)
        ],
        client
      )
    } else {
      if (!original) {
        throw createError({ statusCode: 400, message: 'An original image is required' })
      }
      await rows(
        `INSERT INTO products.media(id,store_id,title,alt,categories,credit,visible,original_file_id,image_file_id,thumbnail_file_id,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(SELECT coalesce(max(position),0)+1 FROM products.media WHERE store_id=$2))`,
        [id, storeId, ...metadata, original.id, image?.id || original.id, thumbnail?.id || null],
        client
      )
    }
    const [current] = await rows<{ image_file_id: string }>(
      'SELECT image_file_id FROM products.media WHERE store_id=$1 AND id=$2',
      [storeId, id],
      client
    )
    await reconcileMediaVariants(
      storeId,
      id,
      current!.image_file_id,
      !!original,
      files,
      data.resetVariants,
      configuration,
      client
    )
    if (data.uploadId) {
      await rows('UPDATE products.media_upload SET committed_media_id=$2 WHERE id=$1', [data.uploadId, id], client)
    }
    return getMedia(storeId, id, true, client)
  })
}
export async function reorderMedia(storeId: string, input: unknown) {
  const data = parseInput(mediaReorderSchema, input)
  return transaction(async (client) => {
    await lockStore(client, storeId)
    const all = await rows<MediaRow>(
      'SELECT * FROM products.media WHERE store_id=$1 ORDER BY position,id FOR UPDATE',
      [storeId],
      client
    )
    const item = all.find((row) => row.id === data.id)
    if (!item || (data.beforeId && !all.some((row) => row.id === data.beforeId))) {
      throw notFound()
    }
    if (item.revision !== data.revision) {
      throw conflict()
    }
    if (data.id === data.beforeId) {
      return
    }
    const ordered = all.filter((row) => row.id !== item.id)
    ordered.splice(data.beforeId ? ordered.findIndex((row) => row.id === data.beforeId) : ordered.length, 0, item)
    for (const [index, row] of ordered.entries()) {
      if (row.position !== index + 1) {
        await rows(
          'UPDATE products.media SET position=$3,revision=revision+1,updated_at=now() WHERE store_id=$1 AND id=$2',
          [storeId, row.id, index + 1],
          client
        )
      }
    }
  })
}
export async function deleteMedia(storeId: string, id: string, revision: number) {
  return transaction(async (client) => {
    await lockStore(client, storeId)
    const used = await rows(
      `SELECT a.id FROM products.asset a JOIN products.product p ON p.id=a.product_id
      WHERE a.media_id=$1 AND p.store_id=$2 AND p.data->'imageIds' ? a.id LIMIT 1`,
      [id, storeId],
      client
    )
    if (used.length) {
      throw createError({
        statusCode: 409,
        data: { code: 'media_in_use' },
        message: 'This image is used by a product. Remove it from the product before deleting it.'
      })
    }
    const result = await rows(
      'DELETE FROM products.media WHERE store_id=$1 AND id=$2 AND revision=$3 RETURNING id',
      [storeId, id, revision],
      client
    )
    if (!result.length) {
      throw conflict()
    }
    return { deleted: true }
  })
}
export async function resolveMediaFile(storeId: string, id: string, manage: boolean, variant: string, source = false) {
  if ((variant === 'original' || source) && !manage) {
    throw notFound()
  }
  const [media] = await rows<MediaRow>(
    'SELECT * FROM products.media WHERE store_id=$1 AND id=$2 AND ($3::boolean OR visible)',
    [storeId, id, manage]
  )
  if (!media) {
    throw notFound()
  }
  let fileId: string | null | undefined
  if (variant === 'image' || variant === 'original') {
    if (source) {
      throw notFound()
    }
    fileId = variant === 'image' ? media.image_file_id : media.original_file_id
  } else {
    const [saved] = await rows<MediaVariantRow>(
      'SELECT * FROM products.media_variant WHERE store_id=$1 AND media_id=$2 AND key=$3',
      [storeId, id, variant]
    )
    fileId = saved
      ? source
        ? saved.source_file_id
        : saved.file_id
      : variant === 'thumbnail' && !source
        ? media.thumbnail_file_id || media.image_file_id
        : undefined
  }
  if (!fileId) {
    throw notFound()
  }
  const [file] = await rows<FileRow>('SELECT * FROM products.media_file WHERE store_id=$1 AND id=$2 AND ready', [
    storeId,
    fileId
  ])
  if (!file) {
    throw notFound()
  }
  return file
}
export async function mediaContent(storeId: string, id: string, manage: boolean, variant: string, source = false) {
  const file = await resolveMediaFile(storeId, id, manage, variant, source)
  return { body: await (await mediaObjectStorage()).get(file.object_key), contentType: file.content_type }
}
export async function cleanupMedia() {
  const candidates = await rows<{ id: string }>(
    "SELECT u.id FROM products.media_upload u WHERE u.created_at<now()-interval '24 hours' AND (NOT EXISTS(SELECT 1 FROM products.media_file f WHERE f.upload_id=u.id) OR EXISTS(SELECT 1 FROM products.media_file f WHERE f.upload_id=u.id AND NOT EXISTS(SELECT 1 FROM products.media m WHERE f.id IN(m.original_file_id,m.image_file_id,m.thumbnail_file_id)) AND NOT EXISTS(SELECT 1 FROM products.media_variant v WHERE f.id IN(v.file_id,v.source_file_id)))) ORDER BY u.created_at LIMIT 50"
  )
  let removed = 0
  for (const candidate of candidates) {
    await transaction(async (client) => {
      const [upload] = await rows(
        'SELECT id FROM products.media_upload WHERE id=$1 FOR UPDATE SKIP LOCKED',
        [candidate.id],
        client
      )
      if (!upload) {
        return
      }
      const files = await rows<FileRow>(
        'SELECT f.* FROM products.media_file f WHERE upload_id=$1 AND NOT EXISTS(SELECT 1 FROM products.media m WHERE f.id IN(m.original_file_id,m.image_file_id,m.thumbnail_file_id)) AND NOT EXISTS(SELECT 1 FROM products.media_variant v WHERE f.id IN(v.file_id,v.source_file_id))',
        [candidate.id],
        client
      )
      if (!files.length) {
        await rows(
          'DELETE FROM products.media_upload u WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM products.media_file f WHERE f.upload_id=u.id)',
          [candidate.id],
          client
        )
        return
      }
      const storage = await mediaObjectStorage()
      for (const file of files) {
        await storage.remove(file.object_key)
        await rows('DELETE FROM products.media_file WHERE id=$1', [file.id], client)
        removed++
      }
      await rows(
        'DELETE FROM products.media_upload u WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM products.media_file f WHERE f.upload_id=u.id)',
        [candidate.id],
        client
      )
    })
  }
  return removed
}
