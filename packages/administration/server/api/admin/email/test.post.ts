import { sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailRenderInput, requireEmailAdmin } from '../../../utils/email-admin'

export default defineEventHandler(async (event) => {
  await requireEmailAdmin(event)
  const input = emailRenderInput.extend({ to: emailRenderInput.shape.to.unwrap() }).parse(await readBody(event))
  const result = await sendPortalEmail({
    moduleId: input.moduleId,
    definition: input.definition,
    locale: input.locale,
    text: input.text,
    htmlTemplate: input.htmlTemplate,
    to: input.to,
    values: Object.fromEntries(input.definition.placeholders.map((item) => [item.key, item.example]))
  })
  return { id: result.id }
})
