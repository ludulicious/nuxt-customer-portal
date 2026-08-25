import { savePortalEmailSettings } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailSettingsInput, parseEmailAdminInput, requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  const session = await requireEmailAdmin(event)
  return savePortalEmailSettings(session.user.id, parseEmailAdminInput(emailSettingsInput, await readBody(event)))
})
