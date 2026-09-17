import { coreFeature } from '@nuxt-customer-portal/core/shared/core-feature'
import { emailRecipientName } from '@nuxt-customer-portal/core/shared/email-recipient'
import { pool } from './db'
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
  idempotencyKey?: string
}

// Updated sendEmail function using the template
export const sendEmail = async ({
  to,
  subject,
  params,
  messageId,
  values = {},
  locale,
  idempotencyKey
}: SendEmailArgs) => {
  const definition = coreFeature.emails?.find((item) => item.id === messageId)
  if (!definition) {
    throw new Error(`Unknown core email definition: ${messageId}`)
  }
  const recipient = await pool.query<{ first_name: string | null; name: string | null }>(
    'SELECT first_name,name FROM public."user" WHERE lower(email)=lower($1) LIMIT 1',
    [to]
  )
  return sendPortalEmail({
    moduleId: coreFeature.id,
    definition,
    locale,
    values: {
      recipient_name: emailRecipientName({
        firstName: recipient.rows[0]?.first_name,
        displayName: recipient.rows[0]?.name,
        email: to
      }),
      ...values
    },
    to,
    idempotencyKey,
    text: messageId ? undefined : { subject, body: params.body_text, footer: params.footer_text }
  })
}
