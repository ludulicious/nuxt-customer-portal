import { sql } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { getPortalEmailSettings, sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { getClientEmailLocale } from '@nuxt-customer-portal/clients/server/utils/client-email-locale'
import { timesheetEmails } from '../../shared/emails'
import { formatTimesheetPeriod } from '../../shared/timesheet-dates'
import { eligibleReviewers, reviewRows } from './client-review-requests'

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )
export const notifyReviewRequest = async (requestId: string, action: string) => {
  try {
    const [request] = await reviewRows<{
      linkId: string
      workspaceId: string
      clientId: string
      clientName: string
      supplierName: string
      startsOn: string
      endsOn: string
      version: number
      comment: string | null
    }>(
      db,
      sql`
      select wc.id as "linkId", wc.workspace_organization_id as "workspaceId", wc.client_organization_id as "clientId",
        c.name as "clientName", p.name as "supplierName", r.starts_on::text as "startsOn", r.ends_on::text as "endsOn", r.version,
        (select comment from timesheets.client_review_request_event where request_id = r.id order by created_at desc limit 1) as comment
      from timesheets.client_review_request r join timesheets.workspace_client wc on wc.id = r.workspace_client_id
      join public.organization c on c.id = wc.client_organization_id join public.organization p on p.id = wc.workspace_organization_id where r.id = ${requestId}`
    )
    if (!request) {
      return
    }
    const reviewers = await eligibleReviewers(db, request.linkId)
    const internal = await reviewRows<{ id: string; email: string; name: string }>(
      db,
      sql`
      select distinct u.id, u.email, u.name from public.member m join public."user" u on u.id = m.user_id
      where m.organization_id = ${request.workspaceId} and (m.role in ('owner', 'admin') or exists (
        select 1 from timesheets.client_review_request_entry e where e.request_id = ${requestId} and e.snapshot->>'personId' = u.id))`
    )
    const recipients = action === 'SENT' ? reviewers : action === 'WITHDRAWN' ? [...reviewers, ...internal] : internal
    const defaultLocale = (await getPortalEmailSettings()).defaultLocale
    for (const recipient of new Map(recipients.map((r) => [r.id, r])).values()) {
      const clientSide = reviewers.some((r) => r.id === recipient.id) && !internal.some((r) => r.id === recipient.id)
      const locale = clientSide || action === 'SENT' ? await getClientEmailLocale(request.clientId) : defaultLocale
      const definitionId =
        action === 'SENT'
          ? 'period-requested'
          : action === 'APPROVED'
            ? 'period-approved'
            : action === 'DISPUTED'
              ? 'period-disputed'
              : 'period-withdrawn'
      try {
        await sendPortalEmail({
          moduleId: 'timesheets',
          definition: timesheetEmails.find((d) => d.id === definitionId)!,
          locale,
          to: recipient.email,
          idempotencyKey: `client-period/${requestId}/${request.version}/${recipient.id}`,
          values: {
            recipient_name: escape(recipient.name),
            organization_name: escape(request.supplierName),
            client_name: escape(request.clientName),
            period: escape(formatTimesheetPeriod(request.startsOn, request.endsOn, locale)),
            comment: escape(request.comment ?? ''),
            action_url: new URL(
              `${clientSide || action === 'SENT' ? '/timesheets/approvals' : '/timesheets/client-approvals'}?request=${requestId}`,
              process.env.BETTER_AUTH_URL || process.env.PUBLIC_URL || 'http://localhost:3051'
            ).href
          }
        })
      } catch (error) {
        console.error('Client review request email delivery failed', { requestId, recipientId: recipient.id }, error)
      }
    }
  } catch (error) {
    console.error('Client review request notification failed', { requestId }, error)
  }
}
