import { getPortalEmailSettings, savePortalEmailSettings } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailTextsInput, parseEmailAdminInput, requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  const session = await requireEmailAdmin(event)
  const input = parseEmailAdminInput(emailTextsInput, await readBody(event))
  const current = await getPortalEmailSettings()
  return savePortalEmailSettings(session.user.id, {
    fromName: current.fromName,
    fromEmail: current.fromEmail,
    defaultLocale: current.defaultLocale,
    htmlTemplate: current.usingProjectTemplate ? null : current.htmlTemplate,
    textOverrides: input.textOverrides,
    definitions: input.definitions
  })
})
