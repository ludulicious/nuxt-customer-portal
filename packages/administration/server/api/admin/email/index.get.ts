import { getPortalEmailSettings } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  await requireEmailAdmin(event)
  return getPortalEmailSettings()
})
