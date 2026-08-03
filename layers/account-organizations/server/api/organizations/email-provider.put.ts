import { z } from 'zod'
import { requireOrganizationOwnerOrSystemAdmin } from '#portal/server/portal'
import { configureOrganizationEmailCredential, EmailProviderRejectedError } from '#portal/server/utils/organization-email-provider'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalOrganizationsEmailProviderPut',
    summary: 'Save organization email credentials',
    description: 'Save organization email credentials. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

const schema = z.object({ apiKey: z.string().trim().min(8).max(500) })
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestedOrganizationId = typeof query.organizationId === 'string' ? query.organizationId : undefined
  const { organizationId, session } = await requireOrganizationOwnerOrSystemAdmin(event, requestedOrganizationId)
  try {
    return await configureOrganizationEmailCredential(organizationId, session.user.id, schema.parse(await readBody(event)).apiKey)
  } catch (error) {
    if (error instanceof EmailProviderRejectedError) {
      const permissionRequired = error.reason === 'DOMAIN_PERMISSION_REQUIRED'
      throw createError({
        statusCode: 422,
        message: permissionRequired ? 'The Resend API key is restricted to sending email' : 'The Resend API key could not be validated',
        data: { code: permissionRequired ? 'RESEND_DOMAIN_PERMISSION_REQUIRED' : 'RESEND_KEY_REJECTED' }
      })
    }
    throw error
  }
})
