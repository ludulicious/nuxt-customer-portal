import { and, desc, eq, isNull } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '@nuxt-customer-portal/core/server/portal'
import {
  internalApproverAssignment,
  timesheetSubmission,
  timesheetClientReview,
  timesheetApprovalEmail,
  workspaceSettings
} from '../db/schema/timesheets'
import { internalEmailRecipients, clientEmailRecipients } from './timesheet-email-recipients'

export const approvalEmailContext = async (
  organizationId: string,
  actorUserId: string,
  role: string,
  submissionId: string,
  clientOrganizationId?: string
) => {
  const [submission] = await db
    .select()
    .from(timesheetSubmission)
    .where(and(eq(timesheetSubmission.id, submissionId), eq(timesheetSubmission.organizationId, organizationId)))
    .limit(1)
  if (!submission) {
    throw createError({ statusCode: 404, message: 'Timesheet submission not found' })
  }
  let emailScope = ''
  let version = submission.version
  let canResend: boolean
  if (clientOrganizationId) {
    if (!['owner', 'admin'].includes(role)) {
      throw createError({ statusCode: 403, message: 'Workspace administrator access required' })
    }
    const [review] = await db
      .select()
      .from(timesheetClientReview)
      .where(
        and(
          eq(timesheetClientReview.submissionId, submissionId),
          eq(timesheetClientReview.clientOrganizationId, clientOrganizationId)
        )
      )
      .limit(1)
    if (!review) {
      throw createError({ statusCode: 404, message: 'Client approval request not found' })
    }
    emailScope = `${review.id}/${review.version}`
    version = review.version
    canResend = submission.status === 'APPROVED' && review.status === 'PENDING'
  } else {
    const [assignment] = await db
      .select()
      .from(internalApproverAssignment)
      .where(
        and(
          eq(internalApproverAssignment.organizationId, organizationId),
          eq(internalApproverAssignment.submitterUserId, submission.userId),
          eq(internalApproverAssignment.approverUserId, actorUserId)
        )
      )
      .limit(1)
    if (!assignment) {
      throw createError({ statusCode: 403, message: 'You are not assigned to approve this member' })
    }
    const [settings] = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.organizationId, organizationId))
      .limit(1)
    canResend = submission.status === 'SUBMITTED' && Boolean(settings?.internalApprovalsEnabled)
  }
  const recipients = clientOrganizationId
    ? (await clientEmailRecipients(organizationId, submissionId)).filter(
        (item) => item.clientId === clientOrganizationId
      )
    : await internalEmailRecipients(organizationId, submission.userId)
  const [latest] = await db
    .select()
    .from(timesheetApprovalEmail)
    .where(
      and(
        eq(timesheetApprovalEmail.submissionId, submissionId),
        eq(timesheetApprovalEmail.kind, clientOrganizationId ? 'client-requested' : 'internal-requested'),
        clientOrganizationId
          ? eq(timesheetApprovalEmail.clientOrganizationId, clientOrganizationId)
          : isNull(timesheetApprovalEmail.clientOrganizationId)
      )
    )
    .orderBy(desc(timesheetApprovalEmail.createdAt))
    .limit(1)
  return {
    submission,
    emailScope,
    context: {
      recipients: recipients.map(({ id, name, email }) => ({ id, name, email })),
      version,
      canResend: canResend && recipients.length > 0,
      message: latest?.message ?? ''
    }
  }
}
