import {
  appendResponseHeader,
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  sendNoContent,
  setResponseHeader
} from 'h3'
import { resolveWebsiteOrigins } from '../utils/website-origins'

const accountRoutes: Record<string, string> = {
  '/api/auth/get-session': 'GET',
  '/api/auth/sign-out': 'POST'
}

export default defineEventHandler(async (event) => {
  const method = accountRoutes[getRequestURL(event).pathname]
  if (!method) {
    return
  }

  appendResponseHeader(event, 'Vary', 'Origin')
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const origin = getHeader(event, 'origin')
  if (!origin) {
    return
  }

  const allowed = (await resolveWebsiteOrigins()).includes(origin)
  if (event.method === 'OPTIONS') {
    const requestedMethod = getHeader(event, 'access-control-request-method')
    const requestedHeaders = (getHeader(event, 'access-control-request-headers') || '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean)
    if (!allowed || requestedMethod !== method || requestedHeaders.some((header) => header !== 'content-type')) {
      throw createError({ statusCode: 403, message: 'Website account request is not allowed' })
    }
    setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
    setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
    setResponseHeader(event, 'Access-Control-Allow-Methods', method)
    setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
    return sendNoContent(event, 204)
  }

  if (allowed && event.method === method) {
    setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
    setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
  }
})
