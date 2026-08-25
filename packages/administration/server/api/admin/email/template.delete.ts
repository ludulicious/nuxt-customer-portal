import { resetPortalEmailTemplate } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  const session = await requireEmailAdmin(event)
  return resetPortalEmailTemplate(session.user.id)
})
