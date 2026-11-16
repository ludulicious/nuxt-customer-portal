import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { toWebRequest, getRequestURL } from 'h3'
import { organizationListImageResponse } from '../../utils/organization-images'

defineRouteMeta({
  openAPI: {
    tags: ['Authentication'],
    operationId: 'generalAuthAllAll',
    summary: 'Handle an authentication request',
    description:
      'Better Auth catch-all transport. Concrete authentication routes are documented separately from Better Auth’s generated OpenAPI contract.',
    'x-scalar-ignore': true
  }
})

export default defineEventHandler(async (event) => {
  // The auth.handler expects a standard Request object
  const response = await auth.handler(toWebRequest(event))
  return event.method === 'GET' && getRequestURL(event).pathname === '/api/auth/organization/list'
    ? organizationListImageResponse(response)
    : response
})
