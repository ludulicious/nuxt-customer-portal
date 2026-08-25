import {
  getPortalEmailSettings,
  savePortalEmailSettings
} from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailProviderInput, parseEmailAdminInput, requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  const session = await requireEmailAdmin(event)
  const input = parseEmailAdminInput(emailProviderInput, await readBody(event))
  const current = await getPortalEmailSettings()
  return savePortalEmailSettings(session.user.id, {
    ...input,
    htmlTemplate: current.usingProjectTemplate ? null : current.htmlTemplate,
    textOverrides: current.textOverrides
  })
})
