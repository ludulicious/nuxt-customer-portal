import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createError } from 'h3'
import sharp from 'sharp'
import { createStorageClient, resolveStorageConfiguration } from './storage-configuration'
import { mediaMaximum, mediaContentTypes } from '../../shared/media'

export async function validateMediaImage(body: Buffer, contentType: string) {
  if (
    !body.length ||
    body.length > mediaMaximum ||
    !mediaContentTypes.includes(contentType as (typeof mediaContentTypes)[number])
  ) {
    throw createError({ statusCode: 400, message: 'Invalid image size or format' })
  }
  try {
    const image = sharp(body, { limitInputPixels: 40_000_000, animated: true })
    const metadata = await image.metadata()
    if (`image/${metadata.format}` !== contentType || !metadata.width || !metadata.height) {
      throw new Error('Invalid image format')
    }
    // Decode all pixels, including GIF frames, before accepting the object.
    await image.stats()
    const sideways = [5, 6, 7, 8].includes(metadata.orientation || 1)
    const width = sideways ? metadata.height : metadata.width
    const height = sideways ? metadata.width : metadata.pageHeight || metadata.height
    return { width, height }
  } catch {
    throw createError({ statusCode: 422, message: 'The image could not be decoded or exceeds the pixel limit' })
  }
}
export interface MediaObjectStorage {
  put: (key: string, body: Buffer, contentType: string) => Promise<void>
  get: (key: string) => Promise<Buffer>
  remove: (key: string) => Promise<void>
}
export async function mediaObjectStorage(): Promise<MediaObjectStorage> {
  const config = await resolveStorageConfiguration()
  if (config.provider === 'bunny') {
    const request = async (key: string, method: string, body?: Buffer, contentType?: string) => {
      const url = `${config.endpoint!.replace(/\/$/, '')}/${encodeURIComponent(config.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
      const response = await fetch(url, {
        method,
        headers: {
          AccessKey: config.credentials!.secretAccessKey,
          ...(contentType ? { 'Content-Type': contentType } : {})
        },
        body: body ? Uint8Array.from(body) : undefined
      })
      if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
        await response.body?.cancel()
        throw createError({ statusCode: 502, message: 'Media storage request failed' })
      }
      return response
    }
    return {
      put: async (key, body, type) => {
        const response = await request(key, 'PUT', body, type)
        await response.body?.cancel()
      },
      get: async (key) => Buffer.from(await (await request(key, 'GET')).arrayBuffer()),
      remove: async (key) => {
        const response = await request(key, 'DELETE')
        await response.body?.cancel()
      }
    }
  }
  const useClient = async <T>(work: (client: ReturnType<typeof createStorageClient>) => Promise<T>) => {
    const client = createStorageClient(config)
    try {
      return await work(client)
    } finally {
      client.destroy()
    }
  }
  return {
    put: (Key, Body, ContentType) =>
      useClient(async (client) => {
        await client.send(new PutObjectCommand({ Bucket: config.bucket, Key, Body, ContentType }))
      }),
    get: (Key) =>
      useClient(async (client) => {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key }))
        return Buffer.from(await result.Body!.transformToByteArray())
      }),
    remove: (Key) =>
      useClient(async (client) => {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key }))
      })
  }
}
