import { renderPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailRenderInput, requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  await requireEmailAdmin(event)
  const input = emailRenderInput.parse(await readBody(event))
  return renderPortalEmail({
    moduleId: input.moduleId,
    definition: input.definition,
    locale: input.locale,
    text: input.text,
    htmlTemplate: input.htmlTemplate,
    values: Object.fromEntries(input.definition.placeholders.map((item) => [item.key, item.example]))
  })
})
