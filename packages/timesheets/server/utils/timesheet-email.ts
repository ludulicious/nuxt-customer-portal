import { internalEmailRecipients, clientEmailRecipients } from './timesheet-email-recipients'
import { sendTrackedApprovalEmail } from './timesheet-approval-email'
import { formatTimesheetPeriod } from '../../shared/timesheet-dates'
import { getClientEmailLocale } from '@nuxt-customer-portal/clients/server/utils/client-email-locale'
import { eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { organization, user } from '@nuxt-customer-portal/core/schema'
import { getPortalEmailSettings, sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailRecipientName } from '@nuxt-customer-portal/core/shared/email-recipient'
import { timesheetEmails } from '../../shared/emails'
import { timesheetSubmission, type TimesheetSubmissionRecord } from '../db/schema/timesheets'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )

type NotificationEvent = 'submitted' | 'approved' | 'rejected' | 'reopened'

// Delivery is deliberately outside the transaction. An unavailable provider must not
// turn a committed approval into an API error that invites a duplicate action.
export const notifyTimesheetEvent = async (
  submission: TimesheetSubmissionRecord | undefined,
  event: NotificationEvent,
  client?: { id: string; version: number; status: string; comment: string | null },
  reply?: string,
  replyClientId?: string,
  resend?: { requestId: string; recipients: Array<{ id: string; email: string }> }
) => {
  if (!submission) {
    return
  }
  try {
    const [person] = await db.select().from(user).where(eq(user.id, submission.userId)).limit(1)
    const [workspace] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, submission.organizationId))
      .limit(1)
    if (!person || !workspace) {
      return
    }
    const { defaultLocale: locale } = await getPortalEmailSettings()
    const baseUrl = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3051'
    const send = async (
      id: string,
      recipient: { id: string; email: string; name: string; firstName?: string | null },
      path: string,
      clientName = '',
      comment = '',
      scope = '',
      emailLocale = locale,
      clientOrganizationId: string | null = null
    ) => {
      // A reassignment during sending must never add an unconfirmed recipient.
      if (resend && !resend.recipients.some((item) => item.id === recipient.id && item.email === recipient.email)) {
        return
      }
      try {
        const input = {
          moduleId: 'timesheets',
          locale: emailLocale,
          definition: timesheetEmails.find((definition) => definition.id === id)!,
          to: recipient.email,
          idempotencyKey: `timesheet/${submission.id}/${submission.version}/${id}/${scope}/${recipient.id}`,
          values: {
            recipient_name: escapeHtml(
              emailRecipientName({
                firstName: recipient.firstName,
                displayName: recipient.name,
                email: recipient.email
              })
            ),
            person_name: escapeHtml(person.name),
            organization_name: escapeHtml(workspace.name),
            period: escapeHtml(formatTimesheetPeriod(submission.periodStartsOn, submission.periodEndsOn, emailLocale)),
            period_start: submission.periodStartsOn,
            period_end: submission.periodEndsOn,
            client_name: escapeHtml(clientName),
            comment: escapeHtml(comment),
            action_url: escapeHtml(new URL(path, baseUrl).href)
          }
        }
        if (id === 'internal-requested' || id === 'client-requested') {
          await sendTrackedApprovalEmail(input, {
            submissionId: submission.id,
            clientOrganizationId,
            kind: id,
            recipient,
            message: comment,
            requestId: resend?.requestId
          })
        } else {
          await sendPortalEmail(input)
        }
      } catch (error) {
        console.error(
          'Timesheet email delivery failed',
          { submissionId: submission.id, event: id, recipientId: recipient.id },
          error
        )
      }
    }
    if (client) {
      const [clientOrganization] = await db.select().from(organization).where(eq(organization.id, client.id)).limit(1)
      await send(
        client.status === 'APPROVED' ? 'client-approved' : 'client-disputed',
        person,
        '/timesheets',
        clientOrganization?.name,
        client.comment ?? '',
        `${client.id}/${client.version}`
      )
      return
    }
    if (event === 'submitted' && submission.status === 'SUBMITTED') {
      const reviewers = await internalEmailRecipients(submission.organizationId, submission.userId)
      await Promise.all(
        reviewers.map((reviewer) =>
          send(
            'internal-requested',
            reviewer,
            `/timesheets/internal-approvals?${new URLSearchParams({ status: 'SUBMITTED', userId: submission.userId })}`,
            '',
            reply ?? ''
          )
        )
      )
      return
    }
    const outcome = event === 'submitted' ? 'approved' : event
    if (!replyClientId && !resend) {
      await send(`internal-${outcome}`, person, '/timesheets', '', reply ?? submission.rejectionComment ?? '')
    }
    if (submission.status !== 'APPROVED') {
      return
    }
    const reviewers = await clientEmailRecipients(submission.organizationId, submission.id)
    await Promise.all(
      reviewers
        .filter((reviewer) => !replyClientId || reviewer.clientId === replyClientId)
        .map(async (reviewer) =>
          send(
            'client-requested',
            reviewer,
            `/timesheets/approvals?${new URLSearchParams({ status: 'PENDING', userId: submission.userId })}`,
            reviewer.clientName,
            replyClientId ? (reply ?? '') : '',
            `${reviewer.reviewId}/${reviewer.version}`,
            await getClientEmailLocale(reviewer.clientId),
            reviewer.clientId
          )
        )
    )
  } catch (error) {
    if (resend) {
      throw error
    }
    console.error('Timesheet email notification failed', { submissionId: submission.id, event }, error)
  }
}

export const notifyClientTimesheetEvent = async (review: {
  submissionId: string | null
  clientOrganizationId: string
  version: number
  status: string
  comment: string | null
}) => {
  if (!review.submissionId) {
    return
  }
  try {
    const [submission] = await db
      .select()
      .from(timesheetSubmission)
      .where(eq(timesheetSubmission.id, review.submissionId))
      .limit(1)
    await notifyTimesheetEvent(submission, 'approved', {
      id: review.clientOrganizationId,
      version: review.version,
      status: review.status,
      comment: review.comment
    })
  } catch (error) {
    console.error('Client timesheet email notification failed', { submissionId: review.submissionId }, error)
  }
}
