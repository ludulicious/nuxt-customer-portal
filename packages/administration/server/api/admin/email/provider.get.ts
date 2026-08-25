import { getPortalEmailProviderStatus } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  await requireEmailAdmin(event)
  const status = await getPortalEmailProviderStatus()
  if (!status.configured) {
    throw createError({ statusCode: 409, message: 'Portal email provider is not configured' })
  }
  return status
})
