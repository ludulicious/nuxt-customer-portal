import { getPortalEmailSettings, savePortalEmailSettings } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailSingleTextInput, parseEmailAdminInput, requireEmailAdmin } from '../../../../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  const session = await requireEmailAdmin(event)
  const moduleId = getRouterParam(event, 'moduleId')
  const messageId = getRouterParam(event, 'messageId')
  const locale = getRouterParam(event, 'locale')
  if (!moduleId || !messageId || (locale !== 'en' && locale !== 'nl')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email text identifier' })
  }
  const input = parseEmailAdminInput(emailSingleTextInput, await readBody(event))
  if (input.definition.id !== messageId) {
    throw createError({ statusCode: 400, statusMessage: 'Email definition does not match the message identifier' })
  }
  const current = await getPortalEmailSettings()
  const textOverrides = {
    ...current.textOverrides,
    [`${moduleId}.${messageId}.${locale}`]: input.text
  }
  return savePortalEmailSettings(session.user.id, {
    fromName: current.fromName,
    fromEmail: current.fromEmail,
    defaultLocale: current.defaultLocale,
    htmlTemplate: current.usingProjectTemplate ? null : current.htmlTemplate,
    textOverrides,
    definitions: [{ moduleId, definition: input.definition }]
  })
})
