import { auth } from '~~/server/utils/auth'
import { toWebRequest } from 'h3'

defineRouteMeta({
  openAPI: {
    'tags': ['Authentication'],
    'operationId': 'generalAuthAllAll',
    'summary': 'Handle an authentication request',
    'description': 'Better Auth catch-all transport. Concrete authentication routes are documented separately from Better Auth’s generated OpenAPI contract.',
    'x-scalar-ignore': true
  }
})

export default defineEventHandler(async (event) => {
  // The auth.handler expects a standard Request object
  return auth.handler(toWebRequest(event))
})
