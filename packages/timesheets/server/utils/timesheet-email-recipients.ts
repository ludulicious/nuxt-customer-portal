import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { member, organization, user } from '@nuxt-customer-portal/core/schema'
import {
  internalApproverAssignment,
  workspaceClient,
  workspaceClientReviewer,
  timesheetClientReview
} from '../db/schema/timesheets'

export const internalEmailRecipients = async (organizationId: string, submitterUserId: string) => {
  return await db
    .selectDistinct({ id: user.id, email: user.email, name: user.name })
    .from(internalApproverAssignment)
    .innerJoin(user, eq(user.id, internalApproverAssignment.approverUserId))
    .innerJoin(member, and(eq(member.userId, user.id), eq(member.organizationId, organizationId)))
    .where(
      and(
        eq(internalApproverAssignment.organizationId, organizationId),
        eq(internalApproverAssignment.submitterUserId, submitterUserId)
      )
    )
}

export const clientEmailRecipients = async (organizationId: string, submissionId: string) => {
  const links = await db
    .select({ id: workspaceClient.id, clientId: workspaceClient.clientOrganizationId })
    .from(workspaceClient)
    .where(and(eq(workspaceClient.workspaceOrganizationId, organizationId), eq(workspaceClient.accessMode, 'REVIEW')))
  const { ensureClientReviewers } = await import('./timesheet-repository')
  await Promise.all(links.map((link) => ensureClientReviewers(link.id, link.clientId)))
  return await db
    .selectDistinct({
      id: user.id,
      email: user.email,
      name: user.name,
      clientId: organization.id,
      clientName: organization.name,
      reviewId: timesheetClientReview.id,
      version: timesheetClientReview.version
    })
    .from(timesheetClientReview)
    .innerJoin(
      workspaceClient,
      and(
        eq(workspaceClient.clientOrganizationId, timesheetClientReview.clientOrganizationId),
        eq(workspaceClient.workspaceOrganizationId, organizationId),
        eq(workspaceClient.accessMode, 'REVIEW')
      )
    )
    .innerJoin(member, eq(member.organizationId, workspaceClient.clientOrganizationId))
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(
      workspaceClientReviewer,
      and(
        eq(workspaceClientReviewer.workspaceClientId, workspaceClient.id),
        eq(workspaceClientReviewer.userId, member.userId)
      )
    )
    .innerJoin(organization, eq(organization.id, workspaceClient.clientOrganizationId))
    .where(
      and(
        eq(timesheetClientReview.submissionId, submissionId),
        eq(timesheetClientReview.status, 'PENDING'),
        isNotNull(workspaceClientReviewer.userId)
      )
    )
}
