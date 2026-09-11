import { randomUUID } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { createError, readRawBody, sendRedirect, sendStream, setResponseHeader, type H3Event } from 'h3'
import sharp from 'sharp'
import { z } from 'zod'
import { parseInput } from './validation'
import { rows } from './database'
import { getProduct } from './catalog'
import { createStorageClient, resolveStorageConfiguration } from './storage-configuration'
import { cropSchema } from '../../shared/validation'
import type { Asset, ImagePolicy, ImagePurpose } from '../../shared/types'

const defaultImagePolicy: ImagePolicy = {
  thumbnail: { width: 400, height: 400 },
  gallery: { width: 800, height: 1000 },
  detail: { width: 1200, height: 900 }
}

const publicTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const privateTypes = [
  'application/pdf',
  'application/zip',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
export const uploadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => !/[\r\n]/.test(value)),
    contentType: z.string(),
    size: z
      .number()
      .int()
      .positive()
      .max(2 * 1024 * 1024 * 1024),
    visibility: z.enum(['public', 'private']),
    purpose: z.enum(['thumbnail', 'gallery', 'detail']).optional()
  })
  .superRefine((value, context) => {
    if (!(value.visibility === 'public' ? publicTypes : privateTypes).includes(value.contentType)) {
      context.addIssue({ code: 'custom', path: ['contentType'], message: 'Unsupported file type' })
    }
    if (value.visibility === 'public' && value.size > 10 * 1024 * 1024) {
      context.addIssue({ code: 'custom', path: ['size'], message: 'Images must be under 10 MB' })
    }
    if (value.visibility === 'public' && !value.purpose) {
      context.addIssue({ code: 'custom', path: ['purpose'], message: 'Choose an image purpose' })
    }
  })
export const storage = async () => {
  const config = await resolveStorageConfiguration()
  if (!config.tested) {
    throw createError({ statusCode: 503, message: 'Test the product file storage configuration first' })
  }
  return { config, bucket: config.bucket, client: config.provider === 's3' ? createStorageClient(config) : undefined }
}
const bunnyUrl = (config: Awaited<ReturnType<typeof resolveStorageConfiguration>>, key: string) =>
  `${config.endpoint!.replace(/\/$/, '')}/${encodeURIComponent(config.bucket)}/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
const bunnyFetch = (
  config: Awaited<ReturnType<typeof resolveStorageConfiguration>>,
  key: string,
  init: RequestInit = {}
) =>
  fetch(bunnyUrl(config, key), {
    ...init,
    headers: { AccessKey: config.credentials!.secretAccessKey, ...init.headers }
  })
export async function startUpload(storeId: string, productId: string, input: unknown) {
  await getProduct(storeId, productId)
  const data = parseInput(uploadSchema, input),
    id = randomUUID(),
    imageExtension = data.contentType === 'image/jpeg' ? 'jpg' : data.contentType.split('/')[1],
    key = `products/staging/${storeId}/${productId}/${id}${data.visibility === 'public' ? `.${imageExtension}` : ''}`
  const { config, bucket, client } = await storage()
  const objectKey = config.provider === 'bunny' && data.visibility === 'private'
    ? `products/private/${storeId}/${productId}/${id}`
    : key
  await rows(
    "INSERT INTO products.asset(id,product_id,name,content_type,size,visibility,object_key,source_object_key,status,image_purpose) VALUES($1,$2,$3,$4,$5,$6,$7,$7,'uploading',$8)",
    [id, productId, data.name, data.contentType, data.size, data.visibility, objectKey, data.purpose || null]
  )
  if (config.provider === 'bunny') {
    return {
      id,
      url: `/api/products/admin/products/${encodeURIComponent(productId)}/uploads/${id}/content`,
      fields: {},
      method: 'PUT' as const
    }
  }
  const upload = await createPresignedPost(client!, {
    Bucket: bucket,
    Key: key,
    Expires: 300,
    Fields: { 'Content-Type': data.contentType },
    Conditions: [
      ['content-length-range', data.size, data.size],
      ['eq', '$Content-Type', data.contentType]
    ]
  })
  return { id, ...upload, method: 'POST' as const }
}
export async function uploadBunnyObject(event: H3Event, storeId: string, productId: string, id: string) {
  await getProduct(storeId, productId)
  const [asset] = await rows<Asset & { source_object_key: string }>(
    "SELECT * FROM products.asset WHERE id=$1 AND product_id=$2 AND status='uploading'",
    [id, productId]
  )
  if (!asset) {
    throw createError({ statusCode: 404, message: 'Upload not found' })
  }
  const { config } = await storage()
  if (config.provider !== 'bunny') {
    throw createError({ statusCode: 409, message: 'Direct upload is not available' })
  }
  if (asset.visibility === 'public') {
    const body = await readRawBody(event, false)
    if (!body || body.length !== Number(asset.size)) {
      throw createError({ statusCode: 400, message: 'Upload body size does not match the selected image' })
    }
    const response = await bunnyFetch(config, asset.source_object_key, {
      method: 'PUT',
      headers: { 'Content-Type': asset.content_type },
      body: Uint8Array.from(body)
    })
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500)
      throw createError({ statusCode: 502, message: `Bunny Storage upload failed (${response.status})`, data: details })
    }
    return { id, uploaded: true }
  }
  const target = new URL(bunnyUrl(config, asset.source_object_key))
  await new Promise<void>((resolve, reject) => {
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      method: 'PUT',
      headers: {
        AccessKey: config.credentials!.secretAccessKey,
        'Content-Type': asset.content_type,
        'Content-Length': String(asset.size)
      }
    }, (response) => {
      response.resume()
      response.on('end', () => response.statusCode && response.statusCode >= 200 && response.statusCode < 300
        ? resolve()
        : reject(new Error(`Bunny Storage upload failed (${response.statusCode || 500})`)))
    })
    request.on('error', reject)
    event.node.req.pipe(request)
  })
  return { id, uploaded: true }
}
const bodyBuffer = async (body: unknown) =>
  Buffer.from(await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray())
export async function finishUpload(storeId: string, productId: string, id: string, input: unknown = {}) {
  await getProduct(storeId, productId)
  const [asset] = await rows<Asset & { object_key: string; source_object_key: string; image_purpose: ImagePurpose | null }>(
    'SELECT * FROM products.asset WHERE id=$1 AND product_id=$2',
    [id, productId]
  )
  if (!asset) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  const { config, bucket, client } = await storage()
  const sourceKey = asset.source_object_key || asset.object_key
  const bunnyObject = config.provider === 'bunny' ? await bunnyFetch(config, sourceKey) : undefined
  if (bunnyObject && !bunnyObject.ok) {
    await bunnyObject.body?.cancel()
    throw createError({ statusCode: 400, message: 'Uploaded file was not found' })
  }
  const head = config.provider === 's3'
    ? await client!.send(new HeadObjectCommand({ Bucket: bucket, Key: sourceKey }))
    : { ContentLength: Number(bunnyObject!.headers.get('content-length')), ContentType: bunnyObject!.headers.get('content-type') }
  const contentTypeMismatch =
    config.provider === 's3' && head.ContentType?.split(';')[0] !== asset.content_type
  if (head.ContentLength !== Number(asset.size) || contentTypeMismatch) {
    await bunnyObject?.body?.cancel()
    throw createError({ statusCode: 400, message: 'Upload does not match the expected file' })
  }
  if (asset.visibility === 'private') {
    const finalKey = `products/private/${storeId}/${productId}/${id}`
    if (config.provider === 'bunny') {
      await bunnyObject!.body?.cancel()
    } else {
      await client!.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: finalKey,
          CopySource: encodeURIComponent(`${bucket}/${sourceKey}`).replaceAll('%2F', '/'),
          ContentType: asset.content_type,
          MetadataDirective: 'REPLACE'
        })
      )
      await client!.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }))
    }
    await rows("UPDATE products.asset SET ready=true,status='ready',object_key=$2 WHERE id=$1", [id, finalKey])
    return { id, status: 'ready' }
  }
  await rows("UPDATE products.asset SET status='processing',failure_reason=NULL WHERE id=$1", [id])
  try {
    const crop = parseInput(cropSchema, input)
    const original = config.provider === 'bunny'
      ? Buffer.from(await bunnyObject!.arrayBuffer())
      : await bodyBuffer((await client!.send(new GetObjectCommand({ Bucket: bucket, Key: sourceKey }))).Body)
    const metadata = await sharp(original, { limitInputPixels: 40_000_000 }).metadata()
    const expectedContentType = metadata.format === 'jpg' ? 'image/jpeg' : `image/${metadata.format}`
    if (!metadata.format || expectedContentType !== asset.content_type) {
      throw new Error('invalid_image')
    }
    const oriented = await sharp(original, { limitInputPixels: 40_000_000 })
      .rotate()
      .toBuffer({ resolveWithObject: true })
    const source = sharp(oriented.data)
    if (!oriented.info.width || !oriented.info.height) {
      throw new Error('invalid_image')
    }
    const [storeRow] = await rows<{ image_policy: ImagePolicy }>(
      'SELECT image_policy FROM products.store WHERE id=true AND organization_id=$1',
      [storeId]
    )
    const policy = storeRow?.image_policy || defaultImagePolicy
    const purpose = asset.image_purpose
    if (!purpose) {
      throw new Error('invalid_image_purpose')
    }
    const target = policy[purpose]
    const left = Math.round(crop.x * oriented.info.width),
      top = Math.round(crop.y * oriented.info.height)
    const width = Math.round(crop.width * oriented.info.width),
      height = Math.round(crop.height * oriented.info.height)
    if (width < target.width || height < target.height) {
      throw new Error('image_too_small')
    }
    if (Math.abs(width / height - target.width / target.height) > 0.01) {
      throw new Error('invalid_aspect_ratio')
    }
    const outputWidth = target.width,
      outputHeight = target.height
    const normalized = await source
      .extract({ left, top, width, height })
      .resize(outputWidth, outputHeight)
      .toColourspace('srgb')
      .webp({ quality: 88 })
      .toBuffer()
    const finalKey = `products/public/${storeId}/${productId}/${id}.webp`
    if (config.provider === 'bunny') {
      const upload = await bunnyFetch(config, finalKey, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public,max-age=31536000,immutable' },
        body: Uint8Array.from(normalized)
      })
      if (!upload.ok) {
        throw new Error('processing_failed')
      }
      const deletion = await bunnyFetch(config, sourceKey, { method: 'DELETE' })
      if (!deletion.ok && deletion.status !== 404) {
        throw new Error('processing_failed')
      }
    } else {
      await client!.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: finalKey,
          Body: normalized,
          ContentType: 'image/webp',
          CacheControl: 'public,max-age=31536000,immutable'
        })
      )
      await client!.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }))
    }
    await rows(
      "UPDATE products.asset SET ready=true,status='ready',object_key=$2,content_type='image/webp',size=$3,width=$4,height=$5 WHERE id=$1",
      [id, finalKey, normalized.length, outputWidth, outputHeight]
    )
    return { id, status: 'ready', width: outputWidth, height: outputHeight }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const reason = ['invalid_image', 'image_too_small', 'invalid_aspect_ratio', 'invalid_image_purpose'].includes(message)
      ? message
      : 'processing_failed'
    await rows("UPDATE products.asset SET ready=false,status='failed',failure_reason=$2 WHERE id=$1", [id, reason])
    throw createError({ statusCode: 422, message: reason })
  }
}
export async function assetUrl(id: string, download = false, fileName?: string) {
  const [asset] = await rows<Asset & { object_key: string }>('SELECT * FROM products.asset WHERE id=$1 AND ready', [id])
  if (!asset) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  if (asset.visibility === 'public' && process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT) {
    return `${process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '')}/${asset.object_key}`
  }
  const { config, bucket, client } = await storage()
  if (config.provider === 'bunny') {
    return `/api/store/media/${encodeURIComponent(id)}${download ? '?download=1' : ''}`
  }
  return getSignedUrl(
    client!,
    new GetObjectCommand({
      Bucket: bucket,
      Key: asset.object_key,
      ResponseContentType: asset.content_type,
      ResponseContentDisposition: `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(fileName || asset.name)}`
    }),
    { expiresIn: 300 }
  )
}

export async function sendAsset(event: H3Event, id: string, download = false, fileName?: string) {
  const [asset] = await rows<Asset & { object_key: string }>('SELECT * FROM products.asset WHERE id=$1 AND ready', [id])
  if (!asset) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  const extension = asset.name.match(/\.[a-z0-9]+$/i)?.[0] || ''
  const responseFileName = fileName
    ? `${fileName}${extension && !fileName.toLowerCase().endsWith(extension.toLowerCase()) ? extension : ''}`
    : asset.name
  if (asset.visibility === 'public' && process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT) {
    return sendRedirect(event, `${process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '')}/${asset.object_key}`)
  }
  const { config } = await storage()
  if (config.provider === 's3') {
    return sendRedirect(event, await assetUrl(id, download, responseFileName))
  }
  const response = await bunnyFetch(config, asset.object_key)
  if (!response.ok || !response.body) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  setResponseHeader(event, 'Content-Type', asset.content_type)
  setResponseHeader(event, 'Content-Length', Number(asset.size))
  setResponseHeader(
    event,
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(responseFileName)}`
  )
  return sendStream(event, Readable.fromWeb(response.body as import('node:stream/web').ReadableStream))
}

export async function cleanupOrphanedAssets() {
  const stale = await rows<{ id: string; object_key: string; source_object_key: string | null }>(
    "SELECT id,object_key,source_object_key FROM products.asset WHERE NOT ready AND created_at<now()-interval '24 hours' ORDER BY created_at LIMIT 50"
  )
  if (!stale.length) {
    return 0
  }
  const { config, bucket, client } = await storage()
  let removed = 0
  for (const asset of stale) {
    for (const key of new Set([asset.object_key, asset.source_object_key].filter(Boolean) as string[])) {
      if (config.provider === 'bunny') {
        await bunnyFetch(config, key, { method: 'DELETE' }).catch(() => undefined)
      } else {
        await client!.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined)
      }
    }
    await rows('DELETE FROM products.asset WHERE id=$1 AND NOT ready', [asset.id])
    removed++
  }
  client?.destroy()
  return removed
}
