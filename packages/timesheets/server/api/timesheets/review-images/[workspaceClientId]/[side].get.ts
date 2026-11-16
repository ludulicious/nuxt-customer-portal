import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { portalImageResponse } from '@nuxt-customer-portal/core/server/utils/portal-image-response'
import { readReviewImage } from '@nuxt-customer-portal/timesheets/server/utils/client-review-requests'

export default defineEventHandler(async (event) => {
  const { organizationId, session, role } = await requireActiveOrganizationRole(event)
  const side = getRouterParam(event, 'side')
  const linkId = getRouterParam(event, 'workspaceClientId')
  if (!linkId || (side !== 'client' && side !== 'supplier')) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }
  const value = await readReviewImage(
    organizationId,
    session.user.id,
    ['owner', 'admin'].includes(role) || session.user.role === 'admin',
    linkId,
    side
  )
  return portalImageResponse(event, value, 'avatar')
})
