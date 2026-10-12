import { and, eq, inArray } from 'drizzle-orm'
import { requireActiveOrganizationRole, db } from '@nuxt-customer-portal/core/server/portal'
import { rejectDemoAction, isPortalDemo } from '@nuxt-customer-portal/core/server/utils/demo'
import { approvalEmailContext } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-approval-email-context'
import { notifyTimesheetEvent } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-email'
import {
  approvalEmailResendSchema,
  approvalEmailRecipientsMatch
} from '@nuxt-customer-portal/timesheets/shared/approval-email'
import { timesheetApprovalEmail } from '@nuxt-customer-portal/timesheets/server/db/schema/timesheets'

export default defineEventHandler(async (event) => {
  const { organizationId, role, session } = await requireActiveOrganizationRole(event)
  if (isPortalDemo()) {
    rejectDemoAction()
  }
  const input = approvalEmailResendSchema.parse(await readBody(event))
  const submissionId = getRouterParam(event, 'id')!
  const { submission, context, emailScope } = await approvalEmailContext(
    organizationId,
    session.user.id,
    role,
    submissionId,
    input.clientOrganizationId
  )
  if (!context.canResend || context.version !== input.version) {
    throw createError({
      statusCode: 409,
      message: 'This approval request is no longer pending. Refresh and try again.'
    })
  }
  if (!approvalEmailRecipientsMatch(context.recipients, input.recipients)) {
    throw createError({
      statusCode: 409,
      message: 'The current approvers have changed. Reopen the resend dialog to check the recipients.'
    })
  }
  await notifyTimesheetEvent(
    submission,
    input.clientOrganizationId ? 'approved' : 'submitted',
    undefined,
    input.message,
    input.clientOrganizationId,
    { requestId: input.requestId, recipients: context.recipients }
  )
  const attempts = await db
    .select()
    .from(timesheetApprovalEmail)
    .where(
      and(
        eq(timesheetApprovalEmail.submissionId, submissionId),
        inArray(
          timesheetApprovalEmail.idempotencyKey,
          context.recipients.map(
            (recipient) =>
              `timesheet/${submission.id}/${submission.version}/${input.clientOrganizationId ? 'client-requested' : 'internal-requested'}/${emailScope}/${recipient.id}/resend/${input.requestId}`
          )
        )
      )
    )
  const sent = attempts.filter((attempt) => attempt.status === 'SENT').length
  const sending = attempts.filter((attempt) => attempt.status === 'SENDING').length
  return { sent, sending, failed: context.recipients.length - sent - sending }
})
