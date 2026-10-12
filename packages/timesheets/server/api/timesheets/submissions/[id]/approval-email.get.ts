import { z } from 'zod'
import { approvalEmailDraft } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-approval-email-draft'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { approvalEmailContext } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-approval-email-context'

export default defineEventHandler(async (event) => {
  const { organizationId, role, session } = await requireActiveOrganizationRole(event)
  const query = z.object({ clientOrganizationId: z.string().min(1).optional() }).parse(getQuery(event))
  const { context, submission } = await approvalEmailContext(
    organizationId,
    session.user.id,
    role,
    getRouterParam(event, 'id')!,
    query.clientOrganizationId
  )
  return { ...context, message: await approvalEmailDraft(submission, context.recipients, query.clientOrganizationId) }
})
