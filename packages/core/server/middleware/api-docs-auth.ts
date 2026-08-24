import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { auth } from '../utils/auth'

const API_DOCS_PATH = '/api-docs'

const isApiDocsRequest = (path: string): boolean => path === API_DOCS_PATH || path.startsWith(`${API_DOCS_PATH}/`)

export default defineEventHandler(async (event) => {
  if (!isApiDocsRequest(event.path)) {
    return
  }

  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const session = await auth.api.getSession({
    headers: event.headers
  })

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication is required to access the API documentation'
    })
  }
})
