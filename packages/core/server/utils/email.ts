import { coreFeature } from '@nuxt-customer-portal/core/shared/core-feature'
import { sendPortalEmail } from './portal-email'

// Define the structure for the parameters used in the template
interface EmailParams {
  greeting?: string
  body_text: string
  action_url: string
  action_text: string
  footer_text: string
}

// Define the arguments for the sendEmail function
interface SendEmailArgs {
  to: string
  subject: string
  params: EmailParams
  messageId?: string
  values?: Record<string, string>
  locale?: string
}

// Updated sendEmail function using the template
export const sendEmail = async ({ to, subject, params, messageId, values = {}, locale }: SendEmailArgs) => {
  const definition = coreFeature.emails?.find((item) => item.id === messageId)
  if (!definition) {
    throw new Error(`Unknown core email definition: ${messageId}`)
  }
  return sendPortalEmail({
    moduleId: coreFeature.id,
    definition,
    locale,
    values,
    to,
    text: messageId ? undefined : { subject, body: params.body_text, footer: params.footer_text }
  })
}
