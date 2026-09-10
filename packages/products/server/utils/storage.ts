import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { randomUUID } from 'node:crypto'
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { createError } from 'h3'
import { z } from 'zod'
import { rows } from './database'
import { getProduct } from './catalog'
import type { Asset } from '../../shared/types'

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
      .refine((v) => !/[\r\n]/.test(v)),
    contentType: z.string(),
    size: z
      .number()
      .int()
      .positive()
      .max(2 * 1024 * 1024 * 1024),
    visibility: z.enum(['public', 'private'])
  })
  .superRefine((v, c) => {
    if (!(v.visibility === 'public' ? publicTypes : privateTypes).includes(v.contentType)) {
      c.addIssue({ code: 'custom', path: ['contentType'], message: 'Unsupported file type' })
    }
    if (v.visibility === 'public' && v.size > 10 * 1024 * 1024) {
      c.addIssue({ code: 'custom', path: ['size'], message: 'Images must be under 10 MB' })
    }
  })
export function storage() {
  const bucket = process.env.PRODUCTS_S3_BUCKET
  if (!bucket) {
    throw createError({ statusCode: 503, message: 'Configure product file storage' })
  }
  return {
    bucket,
    client: new S3Client({
      region: process.env.PRODUCTS_S3_REGION || 'us-east-1',
      endpoint: process.env.PRODUCTS_S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.PRODUCTS_S3_ENDPOINT
    })
  }
}
export async function startUpload(storeId: string, productId: string, input: unknown) {
  await getProduct(storeId, productId)
  const data = parseInput(uploadSchema, input)
  const id = randomUUID(),
    key = `products/${storeId}/${productId}/${id}`
  const { bucket, client } = storage()
  const upload = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Expires: 300,
    Fields: { 'Content-Type': data.contentType },
    Conditions: [
      ['content-length-range', data.size, data.size],
      ['eq', '$Content-Type', data.contentType]
    ]
  })
  await rows(
    'INSERT INTO products.asset(id,product_id,name,content_type,size,visibility,object_key) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [id, productId, data.name, data.contentType, data.size, data.visibility, key]
  )
  return { id, ...upload }
}
export async function finishUpload(storeId: string, productId: string, id: string) {
  await getProduct(storeId, productId)
  const [asset] = await rows<Asset & { object_key: string }>(
    'SELECT * FROM products.asset WHERE id=$1 AND product_id=$2',
    [id, productId]
  )
  if (!asset) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  const { bucket, client } = storage(),
    head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: asset.object_key }))
  if (head.ContentLength !== Number(asset.size) || head.ContentType !== asset.content_type) {
    throw createError({ statusCode: 400, message: 'Upload does not match the expected file' })
  }
  await rows('UPDATE products.asset SET ready=true WHERE id=$1', [id])
  return { id, ready: true }
}
export async function assetUrl(id: string, download = false) {
  const [asset] = await rows<Asset & { object_key: string }>('SELECT * FROM products.asset WHERE id=$1 AND ready', [id])
  if (!asset) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  const { bucket, client } = storage()
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: asset.object_key,
      ResponseContentType: asset.content_type,
      ResponseContentDisposition: `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(asset.name)}`
    }),
    { expiresIn: 300 }
  )
}
