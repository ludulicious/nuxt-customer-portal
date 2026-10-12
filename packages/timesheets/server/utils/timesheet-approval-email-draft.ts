import { eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { user, organization } from '@nuxt-customer-portal/core/schema'
import {
  getPortalEmailSettings,
  resolvePortalEmailBranding
} from '@nuxt-customer-portal/core/server/utils/portal-email'
import { getClientEmailLocale } from '@nuxt-customer-portal/clients/server/utils/client-email-locale'
import { emailRecipientName } from '@nuxt-customer-portal/core/shared/email-recipient'
import { formatTimesheetPeriod } from '../../shared/timesheet-dates'
import { timesheetEmails } from '../../shared/emails'
import type { TimesheetSubmissionRecord } from '../db/schema/timesheets'
import { fillApprovalEmailDraft } from '../../shared/approval-email'

export const approvalEmailDraft = async (
  submission: TimesheetSubmissionRecord,
  recipients: Array<{ name: string; email: string }>,
  clientOrganizationId?: string
) => {
  const settings = await getPortalEmailSettings()
  const branding = await resolvePortalEmailBranding()
  const locale = clientOrganizationId ? await getClientEmailLocale(clientOrganizationId) : settings.defaultLocale
  const kind = clientOrganizationId ? 'client-requested' : 'internal-requested'
  const definition = timesheetEmails.find((item) => item.id === kind)!
  const body = settings.textOverrides[`timesheets.${kind}.${locale}`]?.body ?? definition.defaults[locale].body
  const [person] = await db.select().from(user).where(eq(user.id, submission.userId)).limit(1)
  const [workspace] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, submission.organizationId))
    .limit(1)
  const client = clientOrganizationId
    ? (await db.select().from(organization).where(eq(organization.id, clientOrganizationId)).limit(1))[0]
    : null
  const path = clientOrganizationId ? '/timesheets/approvals' : '/timesheets/internal-approvals'
  const query = new URLSearchParams({
    status: clientOrganizationId ? 'PENDING' : 'SUBMITTED',
    userId: submission.userId
  })
  const baseUrl = process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3051'
  const recipient = recipients.length === 1 ? recipients[0] : undefined
  return fillApprovalEmailDraft(body, {
    ...(recipient
      ? { recipient_name: emailRecipientName({ displayName: recipient.name, email: recipient.email }) }
      : {}),
    person_name: person?.name ?? '',
    organization_name: workspace?.name ?? '',
    client_name: client?.name ?? '',
    brand_name: branding.brandName,
    period: formatTimesheetPeriod(submission.periodStartsOn, submission.periodEndsOn, locale),
    period_start: submission.periodStartsOn,
    period_end: submission.periodEndsOn,
    comment: '',
    action_url: new URL(`${path}?${query}`, baseUrl).href
  })
}
