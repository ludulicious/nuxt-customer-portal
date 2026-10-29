import { mediaVariantConfiguration, saveMediaVariantConfiguration } from './media-variants'
import { createError, defineEventHandler, getHeader, getQuery, getRequestURL, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { mediaAccess } from './media-access'
import {
  getMedia,
  listMedia,
  saveMedia,
  startMediaUpload,
  putMediaUpload,
  reorderMedia,
  deleteMedia,
  mediaContent
} from './media'
import { mediaMaximum } from '../../shared/media'
import { parseInput } from './validation'

// Bound binary/JSON route inference here; public DTOs live in shared/media.ts.
export default defineEventHandler(async (event): Promise<unknown> => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Vary', 'Authorization, Cookie')
  const path = getRequestURL(event).pathname.slice('/api/products/media'.length).split('/').filter(Boolean)
  const access = await mediaAccess(event, event.method === 'GET' ? 'read' : 'manage')
  if (!path.length) {
    if (event.method === 'GET') {
      return listMedia(access.storeId, access.manage, getQuery(event))
    }
    if (event.method === 'PUT') {
      return saveMedia(access.storeId, await readBody(event))
    }
  }
  if (path.length === 1 && path[0] === 'presets') {
    if (event.method === 'GET') {
      return mediaVariantConfiguration(access.storeId)
    }
    if (event.method === 'PUT') {
      return saveMediaVariantConfiguration(access.storeId, await readBody(event))
    }
  }
  if (path.length === 1 && path[0] === 'reorder' && event.method === 'PUT') {
    await reorderMedia(access.storeId, await readBody(event))
    return { reordered: true }
  }
  if (path[0] === 'uploads') {
    if (path.length === 1 && event.method === 'POST') {
      return startMediaUpload(access.storeId, await readBody(event))
    }
    if (path.length === 3 && path[2] === 'complete' && event.method === 'POST') {
      const body = await readBody(event)
      return saveMedia(access.storeId, { ...body, uploadId: path[1] })
    }
    if (path.length === 3 && event.method === 'PUT') {
      const expected = Number(getHeader(event, 'content-length'))
      if (!Number.isSafeInteger(expected) || expected < 1 || expected > mediaMaximum) {
        throw createError({ statusCode: 413, message: 'Image upload must be at most 10 MB' })
      }
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of event.node.req) {
        const bytes = Buffer.from(chunk)
        size += bytes.length
        if (size > mediaMaximum || size > expected) {
          throw createError({ statusCode: 413, message: 'Image upload exceeds its declared size' })
        }
        chunks.push(bytes)
      }
      return putMediaUpload(access.storeId, path[1]!, path[2]!, Buffer.concat(chunks))
    }
  } else if (path.length === 1) {
    if (event.method === 'GET') {
      return getMedia(access.storeId, path[0]!, access.manage)
    }
    if (event.method === 'DELETE') {
      const { revision } = parseInput(z.object({ revision: z.number().int().positive() }), await readBody(event))
      return deleteMedia(access.storeId, path[0]!, revision)
    }
  } else if (path.length === 2 && path[1] === 'content' && event.method === 'GET') {
    const content = await mediaContent(
      access.storeId,
      path[0]!,
      access.manage,
      String(getQuery(event).variant || 'image'),
      getQuery(event).source === '1'
    )
    setHeader(event, 'Content-Type', content.contentType)
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return content.body
  }
  throw createError({ statusCode: 404, message: 'Media endpoint not found' })
})
