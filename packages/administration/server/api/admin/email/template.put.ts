import {
  getPortalEmailSettings,
  savePortalEmailSettings
} from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailTemplateInput, parseEmailAdminInput, requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  const session = await requireEmailAdmin(event)
  const input = parseEmailAdminInput(emailTemplateInput, await readBody(event))
  const current = await getPortalEmailSettings()
  return savePortalEmailSettings(session.user.id, {
    fromName: current.fromName,
    fromEmail: current.fromEmail,
    defaultLocale: current.defaultLocale,
    htmlTemplate: input.htmlTemplate,
    textOverrides: current.textOverrides
  })
})
