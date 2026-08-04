import { nanoid } from 'nanoid'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql
} from 'drizzle-orm'
import {
  db,
  getPortalOrganizationsByIds,
  listPortalOrganizationsForUser,
  listPortalOrganizationMembers
} from '#portal/server/portal'
import { organization, user } from '~~/layers/portal-core/server/db/schema/auth-schema'
import { firstInvoiceNumber, hasNumericInvoiceSequence, incrementInvoiceNumber } from '#layers/timesheets/shared/invoice-number'
import {
  activityType,
  invoice,
  invoiceAttachment,
  invoiceEmailDelivery,
  invoiceHistory,
  invoiceLine,
  invoicePayment,
  invoiceTimeEntry,
  organizationContact,
  organizationInvoiceProfile,
  project,
  projectActivity,
  projectPersonTariff,
  teamTariff,
  timeEntry,
  timesheetClientReview,
  timesheetClientReviewHistory,
  timesheetApprovalHistory,
  weeklyTimesheet,
  workspaceClient,
  workspaceClientReviewer,
  workspaceSettings,
  type TimeEntryRecord,
  type WeeklyTimesheetRecord
} from '#layers/timesheets/server/db/schema/timesheets'
import type {
  ActivityTypeDto,
  ApprovalQueueItemDto,
  ClientDto,
  ProjectDto,
  ReportRowDto,
  TeamMemberDto,
  TimesheetBootstrapDto,
  TimesheetReportDto,
  TimeEntryDto,
  WeekDto,
  InvoiceDto,
  InvoiceableEntryDto,
  ClientAccessMode,
  ClientTimesheetsDto,
  ClientWorkspaceDto,
  ClientReviewerDto,
  ClientApprovalsDto,
  ClientReviewerSupplierDto
} from '#layers/timesheets/shared/types/timesheet'
import { hasInvalidProjectActivityAssignments, type ReportQuery } from './timesheet-validation'
import { addIsoDays, invoiceOverdueDetails, mondayFor } from '#layers/timesheets/shared/timesheet-dates'

const toEntryDto = (row: TimeEntryRecord): TimeEntryDto => ({
  id: row.id,
  projectId: row.projectId,
  activityTypeId: row.activityTypeId,
  entryDate: row.entryDate,
  durationMinutes: row.durationMinutes,
  note: row.note,
  billable: row.billableSnapshot,
  hourlyRateMinor: row.hourlyRateMinorSnapshot,
  currency: row.currencySnapshot,
  timerStartedAt: row.timerStartedAt?.toISOString() ?? null
})

const toWeekDto = (row: WeeklyTimesheetRecord, entries: TimeEntryRecord[]): WeekDto => ({
  id: row.id,
  userId: row.userId,
  weekStartsOn: row.weekStartsOn,
  status: row.status,
  submittedAt: row.submittedAt?.toISOString() ?? null,
  reviewedAt: row.reviewedAt?.toISOString() ?? null,
  reviewedById: row.reviewedById,
  rejectionComment: row.rejectionComment,
  entries: entries.map(toEntryDto)
})

export const ensureSettings = async (organizationId: string) => {
  const [settings] = await db.select().from(workspaceSettings)
    .where(eq(workspaceSettings.organizationId, organizationId)).limit(1)
  if (!settings?.workspaceEnabled) throw createError({ statusCode: 403, message: 'Timesheets workspace is not enabled' })
  return settings
}

export const requireTimesheetWorkspace = async (organizationId: string) => {
  const [settings] = await db.select({ organizationId: workspaceSettings.organizationId, workspaceEnabled: workspaceSettings.workspaceEnabled }).from(workspaceSettings)
    .where(eq(workspaceSettings.organizationId, organizationId)).limit(1)
  if (!settings?.workspaceEnabled) throw createError({ statusCode: 403, message: 'Timesheet entry is not enabled for this organization' })
}

export const requireInvoicingEnabled = async (organizationId: string) => {
  const [settings] = await db.select({ invoicingEnabled: workspaceSettings.invoicingEnabled }).from(workspaceSettings)
    .where(eq(workspaceSettings.organizationId, organizationId)).limit(1)
  if (!settings?.invoicingEnabled) throw createError({ statusCode: 403, message: 'Invoicing is not enabled for this organization' })
}

export const getOrganizationTimesheetCapabilities = async (organizationId: string) => {
  const [settings, clientLinks] = await Promise.all([
    db.select().from(workspaceSettings).where(eq(workspaceSettings.organizationId, organizationId)).limit(1),
    db.select({ workspaceOrganizationId: workspaceClient.workspaceOrganizationId, workspaceName: organization.name, accessMode: workspaceClient.accessMode })
      .from(workspaceClient).innerJoin(organization, eq(organization.id, workspaceClient.workspaceOrganizationId))
      .where(eq(workspaceClient.clientOrganizationId, organizationId)).orderBy(asc(organization.name))
  ])
  return { workspaceEnabled: settings[0]?.workspaceEnabled ?? false, invoicingEnabled: settings[0]?.invoicingEnabled ?? false, clientOf: clientLinks }
}

export const updateOrganizationTimesheetCapabilities = async (organizationId: string, input: { workspaceEnabled: boolean, invoicingEnabled: boolean }) => {
  if (input.invoicingEnabled && !input.workspaceEnabled) throw createError({ statusCode: 400, message: 'Invoicing requires a Timesheets workspace' })
  const [settings] = await db.insert(workspaceSettings).values({ organizationId, ...input }).onConflictDoUpdate({
    target: workspaceSettings.organizationId,
    set: { ...input, updatedAt: new Date() }
  }).returning()
  return settings
}

export const ensureWeek = async (organizationId: string, userId: string, dateString?: string) => {
  const weekStartsOn = mondayFor(dateString)
  await db.insert(weeklyTimesheet).values({
    id: nanoid(),
    organizationId,
    userId,
    weekStartsOn
  }).onConflictDoNothing()
  const [week] = await db.select().from(weeklyTimesheet).where(and(
    eq(weeklyTimesheet.organizationId, organizationId),
    eq(weeklyTimesheet.userId, userId),
    eq(weeklyTimesheet.weekStartsOn, weekStartsOn)
  )).limit(1)
  if (!week) throw createError({ statusCode: 500, message: 'Timesheet week unavailable' })
  return week
}

export const listClients = async (organizationId: string): Promise<ClientDto[]> => {
  const links = await db.select().from(workspaceClient)
    .where(eq(workspaceClient.workspaceOrganizationId, organizationId))
  if (!links.length) return []
  const clientIds = links.map(link => link.clientOrganizationId)
  const [organizations, profiles, contacts] = await Promise.all([
    getPortalOrganizationsByIds(clientIds),
    db.select().from(organizationInvoiceProfile).where(inArray(organizationInvoiceProfile.organizationId, clientIds)),
    db.select().from(organizationContact).where(inArray(organizationContact.organizationId, clientIds)).orderBy(asc(organizationContact.name))
  ])
  const byId = new Map(organizations.map(item => [item.id, item]))
  const profileById = new Map(profiles.map(item => [item.organizationId, item]))
  const officialName = (metadata: string | null) => {
    try {
      const value = metadata ? JSON.parse(metadata) as Record<string, unknown> : {}
      return typeof value.officialCompanyName === 'string' && value.officialCompanyName.trim()
        ? value.officialCompanyName.trim()
        : null
    } catch {
      return null
    }
  }
  return links.flatMap((link) => {
    const client = byId.get(link.clientOrganizationId)
    return client
      ? [{
          id: link.id,
          organizationId: client.id,
          name: client.name,
          officialName: officialName(client.metadata),
          slug: client.slug,
          logo: client.logo,
          address: profileById.get(client.id)?.address ?? '',
          registrationNumber: profileById.get(client.id)?.registrationNumber ?? null,
          vatNumber: profileById.get(client.id)?.vatNumber ?? null,
          invoiceEmail: profileById.get(client.id)?.invoiceEmail ?? null,
          preferredLocale: profileById.get(client.id)?.preferredLocale ?? 'nl',
          accessMode: link.accessMode,
          contacts: contacts.filter(contact => contact.organizationId === client.id).map(contact => ({
            id: contact.id, userId: contact.userId, name: contact.name, email: contact.email,
            phone: contact.phone, jobTitle: contact.jobTitle
          }))
        }]
      : []
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export const getOrganizationInvoiceProfile = async (organizationId: string) => {
  const [organization] = await getPortalOrganizationsByIds([organizationId])
  if (!organization) throw createError({ statusCode: 404, message: 'Organization not found' })
  const [profile] = await db.select().from(organizationInvoiceProfile)
    .where(eq(organizationInvoiceProfile.organizationId, organizationId)).limit(1)
  let officialCompanyName = organization.name
  try {
    const metadata = organization.metadata ? JSON.parse(organization.metadata) as Record<string, unknown> : {}
    if (typeof metadata.officialCompanyName === 'string' && metadata.officialCompanyName.trim()) officialCompanyName = metadata.officialCompanyName
  } catch { /* Retain the organization name for legacy metadata. */ }
  return { organizationId, name: officialCompanyName, logo: organization.logo, address: profile?.address ?? '', registrationNumber: profile?.registrationNumber ?? null,
    vatNumber: profile?.vatNumber ?? null, iban: profile?.iban ?? null, bic: profile?.bic ?? null, invoiceEmail: profile?.invoiceEmail ?? null,
    invoiceEmailTemplate: profile?.invoiceEmailTemplate ?? null, preferredLocale: profile?.preferredLocale ?? 'nl' }
}

export const updateOrganizationInvoiceProfile = async (organizationId: string, targetOrganizationId: string, input: {
  address: string
  registrationNumber?: string | null
  vatNumber?: string | null
  iban?: string | null
  bic?: string | null
  invoiceEmail?: string | null
  invoiceEmailTemplate?: string | null
  preferredLocale?: 'nl' | 'en'
}) => {
  if (targetOrganizationId !== organizationId && !(await listClients(organizationId)).some(client => client.organizationId === targetOrganizationId)) {
    throw createError({ statusCode: 404, message: 'Organization is not available in this workspace' })
  }
  const [profile] = await db.insert(organizationInvoiceProfile).values({ organizationId: targetOrganizationId, ...input })
    .onConflictDoUpdate({ target: organizationInvoiceProfile.organizationId, set: { ...input, updatedAt: new Date() } }).returning()
  return profile
}

export const createOrganizationContact = async (workspaceOrganizationId: string, clientOrganizationId: string, input: {
  userId?: string | null
  name: string
  email: string
  phone?: string | null
  jobTitle?: string | null
}) => {
  if (!(await listClients(workspaceOrganizationId)).some(client => client.organizationId === clientOrganizationId)) throw createError({ statusCode: 404, message: 'Client not found' })
  const [duplicate] = await db.select({ id: organizationContact.id }).from(organizationContact).where(and(
    eq(organizationContact.organizationId, clientOrganizationId),
    sql`lower(${organizationContact.email}) = lower(${input.email})`
  )).limit(1)
  if (duplicate) throw createError({ statusCode: 409, message: 'A contact with this email address already exists' })
  try {
    const [created] = await db.insert(organizationContact).values({ id: nanoid(), organizationId: clientOrganizationId, ...input }).returning()
    return created
  } catch (error) {
    const databaseError = error as { code?: string, cause?: { code?: string } }
    if (databaseError.code === '23505' || databaseError.cause?.code === '23505') {
      throw createError({ statusCode: 409, message: 'A contact with this email address already exists' })
    }
    throw error
  }
}

export const updateOrganizationContact = async (workspaceOrganizationId: string, clientOrganizationId: string, id: string, input: Record<string, unknown>) => {
  if (!(await listClients(workspaceOrganizationId)).some(client => client.organizationId === clientOrganizationId)) throw createError({ statusCode: 404, message: 'Client not found' })
  if (typeof input.email === 'string') {
    const [duplicate] = await db.select({ id: organizationContact.id }).from(organizationContact).where(and(
      eq(organizationContact.organizationId, clientOrganizationId),
      sql`lower(${organizationContact.email}) = lower(${input.email})`
    )).limit(1)
    if (duplicate && duplicate.id !== id) throw createError({ statusCode: 409, message: 'A contact with this email address already exists' })
  }
  try {
    const [updated] = await db.update(organizationContact).set({ ...input, updatedAt: new Date() }).where(and(eq(organizationContact.id, id), eq(organizationContact.organizationId, clientOrganizationId))).returning()
    if (!updated) throw createError({ statusCode: 404, message: 'Contact not found' })
    return updated
  } catch (error) {
    const databaseError = error as { code?: string, cause?: { code?: string } }
    if (databaseError.code === '23505' || databaseError.cause?.code === '23505') {
      throw createError({ statusCode: 409, message: 'A contact with this email address already exists' })
    }
    throw error
  }
}

export const deleteOrganizationContact = async (workspaceOrganizationId: string, clientOrganizationId: string, id: string) => {
  if (!(await listClients(workspaceOrganizationId)).some(client => client.organizationId === clientOrganizationId)) throw createError({ statusCode: 404, message: 'Client not found' })
  const [deleted] = await db.delete(organizationContact).where(and(eq(organizationContact.id, id), eq(organizationContact.organizationId, clientOrganizationId))).returning()
  if (!deleted) throw createError({ statusCode: 404, message: 'Contact not found' })
  return { deleted: true }
}

export const listAvailableClientOrganizations = async (
  organizationId: string,
  userId: string,
  hasSystemAccess: boolean
) => {
  const [accessible, clients] = await Promise.all([
    listPortalOrganizationsForUser(userId, hasSystemAccess),
    listClients(organizationId)
  ])
  const linkedIds = new Set(clients.map(client => client.organizationId))
  return accessible.filter(item => !linkedIds.has(item.id))
}

export const linkClient = async (
  organizationId: string,
  userId: string,
  hasSystemAccess: boolean,
  clientOrganizationId: string
) => {
  const client = (await listPortalOrganizationsForUser(userId, hasSystemAccess))
    .find(item => item.id === clientOrganizationId)
  if (!client) throw createError({ statusCode: 404, message: 'Client organization not found' })
  const [link] = await db.insert(workspaceClient).values({
    id: nanoid(),
    workspaceOrganizationId: organizationId,
    clientOrganizationId: client.id
  }).onConflictDoNothing().returning()
  if (!link) throw createError({ statusCode: 409, message: 'Client is already linked' })
  return link
}

export const updateClientAccess = async (organizationId: string, id: string, accessMode: ClientAccessMode) => {
  const [updated] = await db.update(workspaceClient).set({ accessMode, updatedAt: new Date() }).where(and(
    eq(workspaceClient.id, id), eq(workspaceClient.workspaceOrganizationId, organizationId)
  )).returning()
  if (!updated) throw createError({ statusCode: 404, message: 'Client not found' })
  return updated
}

export const listClientWorkspaces = async (clientOrganizationId: string, userId: string, canManageReviewers: boolean): Promise<ClientWorkspaceDto[]> => {
  const links = await db.select({ link: workspaceClient, workspaceName: organization.name })
    .from(workspaceClient).innerJoin(organization, eq(organization.id, workspaceClient.workspaceOrganizationId))
    .where(and(eq(workspaceClient.clientOrganizationId, clientOrganizationId), inArray(workspaceClient.accessMode, ['VIEW', 'REVIEW'])))
    .orderBy(asc(organization.name))
  const reviews = links.length
    ? await db.select().from(workspaceClientReviewer).where(and(
        inArray(workspaceClientReviewer.workspaceClientId, links.map(item => item.link.id)), eq(workspaceClientReviewer.userId, userId)
      ))
    : []
  const reviewerLinks = new Set(reviews.map(item => item.workspaceClientId))
  return links.map(({ link, workspaceName }) => ({ id: link.id, workspaceOrganizationId: link.workspaceOrganizationId, workspaceName, accessMode: link.accessMode, canReview: link.accessMode === 'REVIEW' && reviewerLinks.has(link.id), canManageReviewers }))
}

export const listClientReviewers = async (workspaceClientId: string, clientOrganizationId: string): Promise<ClientReviewerDto[]> => {
  const [link] = await db.select().from(workspaceClient).where(and(eq(workspaceClient.id, workspaceClientId), eq(workspaceClient.clientOrganizationId, clientOrganizationId))).limit(1)
  if (!link || link.accessMode === 'DISABLED') throw createError({ statusCode: 404, message: 'Client workspace not found' })
  const [members, assigned] = await Promise.all([listPortalOrganizationMembers(clientOrganizationId), db.select().from(workspaceClientReviewer).where(eq(workspaceClientReviewer.workspaceClientId, workspaceClientId))])
  const assignedIds = new Set(assigned.map(item => item.userId))
  return members.map(item => ({ id: item.id, name: item.name, email: item.email, assigned: assignedIds.has(item.id) }))
}

export const listClientReviewerSuppliers = async (clientOrganizationId: string, userId: string): Promise<ClientReviewerSupplierDto[]> => {
  const workspaces = (await listClientWorkspaces(clientOrganizationId, userId, true)).filter(item => item.accessMode === 'REVIEW')
  if (!workspaces.length) return []
  const [reviewers, pending] = await Promise.all([
    db.select().from(workspaceClientReviewer).where(inArray(workspaceClientReviewer.workspaceClientId, workspaces.map(item => item.id))),
    db.select({ supplierOrganizationId: weeklyTimesheet.organizationId })
      .from(timesheetClientReview)
      .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetClientReview.weeklyTimesheetId))
      .where(and(eq(timesheetClientReview.clientOrganizationId, clientOrganizationId), eq(timesheetClientReview.status, 'PENDING')))
  ])
  return workspaces.map(workspace => ({
    ...workspace,
    reviewerCount: reviewers.filter(item => item.workspaceClientId === workspace.id).length,
    pendingCount: pending.filter(item => item.supplierOrganizationId === workspace.workspaceOrganizationId).length
  }))
}

export const setClientReviewer = async (workspaceClientId: string, clientOrganizationId: string, actorUserId: string, userId: string, assigned: boolean) => {
  const eligible = await listClientReviewers(workspaceClientId, clientOrganizationId)
  if (!eligible.some(item => item.id === userId)) throw createError({ statusCode: 400, message: 'Reviewer must be a current client member' })
  if (!assigned) {
    await db.delete(workspaceClientReviewer).where(and(eq(workspaceClientReviewer.workspaceClientId, workspaceClientId), eq(workspaceClientReviewer.userId, userId)))
    return { assigned: false }
  }
  await db.insert(workspaceClientReviewer).values({ id: nanoid(), workspaceClientId, userId, createdById: actorUserId }).onConflictDoNothing()
  return { assigned: true }
}

export const listClientApprovals = async (clientOrganizationId: string, actorUserId: string, isAdmin: boolean): Promise<ClientApprovalsDto> => {
  const links = await db.select({ link: workspaceClient, supplierName: organization.name })
    .from(workspaceClient)
    .innerJoin(organization, eq(organization.id, workspaceClient.workspaceOrganizationId))
    .where(and(eq(workspaceClient.clientOrganizationId, clientOrganizationId), eq(workspaceClient.accessMode, 'REVIEW')))
  if (!links.length) return { isAdmin, pendingCount: 0, items: [] }
  const reviews = await db.select().from(timesheetClientReview)
    .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetClientReview.weeklyTimesheetId))
    .where(eq(timesheetClientReview.clientOrganizationId, clientOrganizationId))
  const weekIds = reviews.map(item => item.client_review.weeklyTimesheetId)
  if (!weekIds.length) return { isAdmin, pendingCount: 0, items: [] }
  const [assignments, acted, entries, internalHistory, clientHistory] = await Promise.all([
    db.select().from(workspaceClientReviewer).where(and(
      inArray(workspaceClientReviewer.workspaceClientId, links.map(item => item.link.id)),
      eq(workspaceClientReviewer.userId, actorUserId)
    )),
    db.select({ weeklyTimesheetId: timesheetClientReviewHistory.weeklyTimesheetId })
      .from(timesheetClientReviewHistory)
      .where(and(eq(timesheetClientReviewHistory.clientOrganizationId, clientOrganizationId), eq(timesheetClientReviewHistory.actorUserId, actorUserId))),
    db.select({ entry: timeEntry, projectName: project.name, activityName: activityType.name, personName: user.name })
      .from(timeEntry)
      .innerJoin(project, eq(project.id, timeEntry.projectId))
      .innerJoin(activityType, eq(activityType.id, timeEntry.activityTypeId))
      .innerJoin(user, eq(user.id, timeEntry.userId))
      .where(and(inArray(timeEntry.weeklyTimesheetId, weekIds), eq(timeEntry.clientOrganizationId, clientOrganizationId)))
      .orderBy(asc(timeEntry.entryDate), asc(timeEntry.createdAt)),
    db.select({ history: timesheetApprovalHistory, actorName: user.name })
      .from(timesheetApprovalHistory).innerJoin(user, eq(user.id, timesheetApprovalHistory.actorUserId))
      .where(and(inArray(timesheetApprovalHistory.weeklyTimesheetId, weekIds), inArray(timesheetApprovalHistory.action, ['SUBMITTED', 'APPROVED', 'REOPENED']))),
    db.select({ history: timesheetClientReviewHistory, actorName: user.name })
      .from(timesheetClientReviewHistory).innerJoin(user, eq(user.id, timesheetClientReviewHistory.actorUserId))
      .where(and(inArray(timesheetClientReviewHistory.weeklyTimesheetId, weekIds), eq(timesheetClientReviewHistory.clientOrganizationId, clientOrganizationId)))
  ])
  const assignedLinks = new Set(assignments.map(item => item.workspaceClientId))
  const actedWeeks = new Set(acted.map(item => item.weeklyTimesheetId))
  const reviewerIds = [...new Set(reviews.map(item => item.client_review.reviewerUserId).filter((id): id is string => Boolean(id)))]
  const reviewerUsers = reviewerIds.length ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, reviewerIds)) : []
  const reviewerNames = new Map(reviewerUsers.map(item => [item.id, item.name]))
  const allAssignments = await db.select().from(workspaceClientReviewer).where(inArray(workspaceClientReviewer.workspaceClientId, links.map(item => item.link.id)))
  const items = reviews.flatMap(({ client_review: review, weekly_timesheet: week }) => {
    const link = links.find(item => item.link.workspaceOrganizationId === week.organizationId)
    if (!link || (!isAdmin && !assignedLinks.has(link.link.id) && !actedWeeks.has(week.id))) return []
    const rows = entries.filter(item => item.entry.weeklyTimesheetId === week.id)
    if (!rows.length) return []
    return [{
      id: review.id,
      workspaceClientId: link.link.id,
      supplierName: link.supplierName,
      weeklyTimesheetId: week.id,
      weekStartsOn: week.weekStartsOn,
      person: rows[0]!.personName,
      totalMinutes: rows.reduce((total, item) => total + item.entry.durationMinutes, 0),
      status: review.status,
      version: review.version,
      comment: review.comment,
      reviewedAt: review.reviewedAt?.toISOString() ?? null,
      reviewerName: review.reviewerUserId ? reviewerNames.get(review.reviewerUserId) ?? null : null,
      hasReviewers: allAssignments.some(item => item.workspaceClientId === link.link.id),
      canAct: review.status === 'PENDING' && (isAdmin || assignedLinks.has(link.link.id)),
      canManageReviewers: isAdmin,
      entries: rows.map(({ entry, projectName, activityName, personName }) => ({ id: entry.id, date: entry.entryDate, project: projectName, person: personName, activity: activityName, minutes: entry.durationMinutes, note: entry.note })),
      history: [
        ...internalHistory.filter(item => item.history.weeklyTimesheetId === week.id).map(item => ({ id: item.history.id, action: item.history.action === 'SUBMITTED' ? 'SUBMITTED' as const : item.history.action === 'REOPENED' ? 'REOPENED' as const : 'APPROVED_INTERNAL' as const, actorName: item.actorName, comment: item.history.comment, createdAt: item.history.createdAt.toISOString() })),
        ...clientHistory.filter(item => item.history.weeklyTimesheetId === week.id).map(item => ({ id: item.history.id, action: item.history.action === 'APPROVED' ? 'APPROVED_CLIENT' as const : 'DISPUTED_CLIENT' as const, actorName: item.actorName, comment: item.history.comment, createdAt: item.history.createdAt.toISOString() }))
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }]
  }).sort((a, b) => a.status === b.status ? b.weekStartsOn.localeCompare(a.weekStartsOn) : a.status === 'PENDING' ? -1 : 1)
  return { isAdmin, pendingCount: items.filter(item => item.status === 'PENDING' && item.canAct).length, items }
}

export const listClientApprovalSuppliers = async (clientOrganizationId: string, actorUserId: string, isAdmin: boolean) => {
  const approvals = await listClientApprovals(clientOrganizationId, actorUserId, isAdmin)
  return [...new Map(approvals.items.map(item => [item.workspaceClientId, { id: item.workspaceClientId, name: item.supplierName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
}

const findOwnedClient = async (organizationId: string, id: string) => {
  const [link] = await db.select().from(workspaceClient).where(and(
    eq(workspaceClient.id, id),
    eq(workspaceClient.workspaceOrganizationId, organizationId)
  )).limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'Client not found' })
  const [client] = await getPortalOrganizationsByIds([link.clientOrganizationId])
  if (!client) throw createError({ statusCode: 404, message: 'Client organization not found' })
  return { link, client }
}

export const getClientDeletionEligibility = async (organizationId: string, id: string) => {
  const { link, client } = await findOwnedClient(organizationId, id)
  const [existingProject] = await db.select({ id: project.id }).from(project).where(and(
    eq(project.organizationId, organizationId),
    eq(project.clientOrganizationId, link.clientOrganizationId)
  )).limit(1)
  return { clientId: link.id, clientName: client.name, canDelete: !existingProject }
}

export const deleteClient = async (
  organizationId: string,
  id: string,
  clientName: string
) => db.transaction(async (tx) => {
  const [link] = await tx.select().from(workspaceClient).where(and(
    eq(workspaceClient.id, id),
    eq(workspaceClient.workspaceOrganizationId, organizationId)
  )).limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'Client not found' })
  const [client] = await getPortalOrganizationsByIds([link.clientOrganizationId])
  if (!client) throw createError({ statusCode: 404, message: 'Client organization not found' })
  if (client.name !== clientName) {
    throw createError({ statusCode: 400, message: 'Client name does not match' })
  }
  const [existingProject] = await tx.select({ id: project.id }).from(project).where(and(
    eq(project.organizationId, organizationId),
    eq(project.clientOrganizationId, link.clientOrganizationId)
  )).limit(1)
  if (existingProject) {
    throw createError({ statusCode: 409, message: 'Clients with linked projects cannot be removed' })
  }
  await tx.delete(workspaceClient).where(and(
    eq(workspaceClient.id, id),
    eq(workspaceClient.workspaceOrganizationId, organizationId)
  ))
  return { deleted: true }
})

export const listActivities = async (organizationId: string): Promise<ActivityTypeDto[]> =>
  db.select({
    id: activityType.id,
    name: activityType.name,
    billable: activityType.billable,
    active: activityType.active
  }).from(activityType)
    .where(eq(activityType.organizationId, organizationId))
    .orderBy(desc(activityType.active), asc(activityType.name))

export const createActivity = async (
  organizationId: string,
  input: { name: string, billable: boolean }
) => {
  const [created] = await db.insert(activityType).values({
    id: nanoid(),
    organizationId,
    ...input
  }).returning()
  return created
}

export const updateActivity = async (
  organizationId: string,
  id: string,
  input: Partial<{ name: string, billable: boolean, active: boolean }>
) => {
  const [updated] = await db.update(activityType).set(input).where(and(
    eq(activityType.id, id),
    eq(activityType.organizationId, organizationId)
  )).returning()
  if (!updated) throw createError({ statusCode: 404, message: 'Activity type not found' })
  return updated
}

const findOwnedActivity = async (organizationId: string, id: string) => {
  const [selectedActivity] = await db.select({
    id: activityType.id,
    name: activityType.name
  }).from(activityType).where(and(
    eq(activityType.id, id),
    eq(activityType.organizationId, organizationId)
  )).limit(1)
  if (!selectedActivity) throw createError({ statusCode: 404, message: 'Activity type not found' })
  return selectedActivity
}

export const getActivityDeletionEligibility = async (organizationId: string, id: string) => {
  const selectedActivity = await findOwnedActivity(organizationId, id)
  const [existingEntry] = await db.select({ id: timeEntry.id }).from(timeEntry)
    .where(and(
      eq(timeEntry.organizationId, organizationId),
      eq(timeEntry.activityTypeId, id)
    ))
    .limit(1)
  return {
    activityId: selectedActivity.id,
    activityName: selectedActivity.name,
    canDelete: !existingEntry
  }
}

export const deleteActivity = async (
  organizationId: string,
  id: string,
  activityName: string
) => db.transaction(async (tx) => {
  const [selectedActivity] = await tx.select({
    id: activityType.id,
    name: activityType.name
  }).from(activityType).where(and(
    eq(activityType.id, id),
    eq(activityType.organizationId, organizationId)
  )).limit(1)
  if (!selectedActivity) throw createError({ statusCode: 404, message: 'Activity type not found' })
  if (selectedActivity.name !== activityName) {
    throw createError({ statusCode: 400, message: 'Activity name does not match' })
  }

  const [existingEntry] = await tx.select({ id: timeEntry.id }).from(timeEntry)
    .where(and(
      eq(timeEntry.organizationId, organizationId),
      eq(timeEntry.activityTypeId, id)
    ))
    .limit(1)
  if (existingEntry) {
    throw createError({ statusCode: 409, message: 'Activities with existing time entries cannot be deleted' })
  }

  await tx.delete(activityType).where(and(
    eq(activityType.id, id),
    eq(activityType.organizationId, organizationId)
  ))
  return { deleted: true }
})

export const listTeam = async (organizationId: string): Promise<TeamMemberDto[]> => {
  const [members, tariffs] = await Promise.all([
    listPortalOrganizationMembers(organizationId),
    db.select().from(teamTariff).where(eq(teamTariff.organizationId, organizationId))
  ])
  const tariffByUser = new Map(tariffs.map(item => [item.userId, item.hourlyRateMinor]))
  return members.map(item => ({
    ...item,
    image: item.image ?? null,
    defaultHourlyRateMinor: tariffByUser.get(item.id) ?? null
  }))
}

export const setTeamTariff = async (
  organizationId: string,
  userId: string,
  hourlyRateMinor: number
) => {
  const member = (await listPortalOrganizationMembers(organizationId)).find(item => item.id === userId)
  if (!member) throw createError({ statusCode: 404, message: 'Team member not found' })
  const [row] = await db.insert(teamTariff).values({
    id: nanoid(),
    organizationId,
    userId,
    hourlyRateMinor
  }).onConflictDoUpdate({
    target: [teamTariff.organizationId, teamTariff.userId],
    set: { hourlyRateMinor, updatedAt: new Date() }
  }).returning()
  return row
}

export const listProjects = async (organizationId: string): Promise<ProjectDto[]> => {
  const projects = await db.select().from(project)
    .where(eq(project.organizationId, organizationId))
    .orderBy(desc(project.status), asc(project.name))
  if (!projects.length) return []
  const ids = projects.map(item => item.id)
  const [clients, assignments, rates] = await Promise.all([
    listClients(organizationId),
    db.select().from(projectActivity).where(inArray(projectActivity.projectId, ids)),
    db.select().from(projectPersonTariff).where(inArray(projectPersonTariff.projectId, ids))
  ])
  const clientNames = new Map(clients.map(item => [item.organizationId, item.name]))
  return projects.map(item => ({
    id: item.id,
    clientOrganizationId: item.clientOrganizationId,
    clientName: clientNames.get(item.clientOrganizationId) ?? 'Unknown client',
    name: item.name,
    code: item.code,
    status: item.status,
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    budgetMinutes: item.budgetMinutes,
    budgetMinor: item.budgetMinor,
    activityTypeIds: assignments.filter(link => link.projectId === item.id).map(link => link.activityTypeId),
    personRates: Object.fromEntries(
      rates.filter(rate => rate.projectId === item.id)
        .map(rate => [rate.userId, rate.hourlyRateMinor])
    )
  }))
}

export const createProject = async (
  organizationId: string,
  input: {
    clientOrganizationId: string
    name: string
    code?: string | null
    startsOn?: string | null
    endsOn?: string | null
    budgetMinutes?: number | null
    budgetMinor?: number | null
    activityTypeIds: string[]
  }
) => {
  const clients = await listClients(organizationId)
  if (!clients.some(client => client.organizationId === input.clientOrganizationId)) {
    throw createError({ statusCode: 400, message: 'Client is not linked to this workspace' })
  }
  const validActivities = await listActivities(organizationId)
  if (hasInvalidProjectActivityAssignments(input.activityTypeIds, validActivities)) {
    throw createError({ statusCode: 400, message: 'Invalid activity type assignment' })
  }
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(project).values({
      id: nanoid(),
      organizationId,
      clientOrganizationId: input.clientOrganizationId,
      name: input.name,
      code: input.code,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      budgetMinutes: input.budgetMinutes,
      budgetMinor: input.budgetMinor
    }).returning()
    if (!created) throw createError({ statusCode: 500, message: 'Failed to create project' })
    await tx.insert(projectActivity).values(input.activityTypeIds.map(activityTypeId => ({
      id: nanoid(),
      projectId: created.id,
      activityTypeId
    })))
    return created
  })
}

export const updateProject = async (
  organizationId: string,
  id: string,
  input: Record<string, unknown> & {
    activityTypeIds?: string[]
    personRates?: Record<string, number>
  }
) => {
  const { activityTypeIds, personRates, ...projectValues } = input
  if (typeof projectValues.clientOrganizationId === 'string') {
    const clients = await listClients(organizationId)
    if (!clients.some(client => client.organizationId === projectValues.clientOrganizationId)) {
      throw createError({ statusCode: 400, message: 'Client is not linked to this workspace' })
    }
  }
  return db.transaction(async (tx) => {
    const projectFilter = and(
      eq(project.id, id),
      eq(project.organizationId, organizationId)
    )
    const [updated] = Object.keys(projectValues).length > 0
      ? await tx.update(project).set(projectValues).where(projectFilter).returning()
      : await tx.select().from(project).where(projectFilter).limit(1)
    if (!updated) throw createError({ statusCode: 404, message: 'Project not found' })
    if (activityTypeIds) {
      const [valid, existingAssignments] = await Promise.all([
        tx.select({ id: activityType.id, active: activityType.active })
          .from(activityType)
          .where(eq(activityType.organizationId, organizationId)),
        tx.select({ activityTypeId: projectActivity.activityTypeId })
          .from(projectActivity)
          .where(eq(projectActivity.projectId, id))
      ])
      if (hasInvalidProjectActivityAssignments(
        activityTypeIds,
        valid,
        existingAssignments.map(assignment => assignment.activityTypeId)
      )) {
        throw createError({ statusCode: 400, message: 'Invalid activity type assignment' })
      }
      await tx.delete(projectActivity).where(eq(projectActivity.projectId, id))
      if (activityTypeIds.length) {
        await tx.insert(projectActivity).values(activityTypeIds.map(activityTypeId => ({
          id: nanoid(),
          projectId: id,
          activityTypeId
        })))
      }
    }
    if (personRates) {
      const members = await listPortalOrganizationMembers(organizationId)
      if (Object.keys(personRates).some(userId => !members.some(member => member.id === userId))) {
        throw createError({ statusCode: 400, message: 'Invalid project tariff member' })
      }
      await tx.delete(projectPersonTariff).where(eq(projectPersonTariff.projectId, id))
      const values = Object.entries(personRates).map(([userId, hourlyRateMinor]) => ({
        id: nanoid(),
        projectId: id,
        userId,
        hourlyRateMinor
      }))
      if (values.length) await tx.insert(projectPersonTariff).values(values)
    }
    return updated
  })
}

const findOwnedProject = async (organizationId: string, id: string) => {
  const [selectedProject] = await db.select({
    id: project.id,
    name: project.name
  }).from(project).where(and(
    eq(project.id, id),
    eq(project.organizationId, organizationId)
  )).limit(1)
  if (!selectedProject) throw createError({ statusCode: 404, message: 'Project not found' })
  return selectedProject
}

export const getProjectDeletionEligibility = async (organizationId: string, id: string) => {
  const selectedProject = await findOwnedProject(organizationId, id)
  const [existingEntry] = await db.select({ id: timeEntry.id }).from(timeEntry)
    .where(and(
      eq(timeEntry.organizationId, organizationId),
      eq(timeEntry.projectId, id)
    ))
    .limit(1)
  return {
    projectId: selectedProject.id,
    projectName: selectedProject.name,
    canDelete: !existingEntry
  }
}

export const deleteProject = async (
  organizationId: string,
  id: string,
  projectName: string
) => db.transaction(async (tx) => {
  const [selectedProject] = await tx.select({
    id: project.id,
    name: project.name
  }).from(project).where(and(
    eq(project.id, id),
    eq(project.organizationId, organizationId)
  )).limit(1)
  if (!selectedProject) throw createError({ statusCode: 404, message: 'Project not found' })
  if (selectedProject.name !== projectName) {
    throw createError({ statusCode: 400, message: 'Project name does not match' })
  }

  const [existingEntry] = await tx.select({ id: timeEntry.id }).from(timeEntry)
    .where(and(
      eq(timeEntry.organizationId, organizationId),
      eq(timeEntry.projectId, id)
    ))
    .limit(1)
  if (existingEntry) {
    throw createError({ statusCode: 409, message: 'Projects with existing time entries cannot be deleted' })
  }

  await tx.delete(project).where(and(
    eq(project.id, id),
    eq(project.organizationId, organizationId)
  ))
  return { deleted: true }
})

const resolveEntryContext = async (
  organizationId: string,
  userId: string,
  projectId: string,
  activityTypeId: string
) => {
  const [settings, projects, activities, tariffs, overrides] = await Promise.all([
    ensureSettings(organizationId),
    listProjects(organizationId),
    listActivities(organizationId),
    db.select().from(teamTariff).where(and(
      eq(teamTariff.organizationId, organizationId),
      eq(teamTariff.userId, userId)
    )),
    db.select().from(projectPersonTariff).where(and(
      eq(projectPersonTariff.projectId, projectId),
      eq(projectPersonTariff.userId, userId)
    ))
  ])
  const selectedProject = projects.find(item => item.id === projectId && item.status === 'ACTIVE')
  const selectedActivity = activities.find(item => item.id === activityTypeId && item.active)
  if (!selectedProject) throw createError({ statusCode: 400, message: 'Project is unavailable' })
  if (!selectedActivity || !selectedProject.activityTypeIds.includes(activityTypeId)) {
    throw createError({ statusCode: 400, message: 'Activity is unavailable for this project' })
  }
  const rate = selectedActivity.billable
    ? overrides[0]?.hourlyRateMinor ?? tariffs[0]?.hourlyRateMinor
    : 0
  if (selectedActivity.billable && rate === undefined) {
    throw createError({ statusCode: 422, message: 'No billable tariff is configured' })
  }
  return {
    clientOrganizationId: selectedProject.clientOrganizationId,
    billableSnapshot: selectedActivity.billable,
    hourlyRateMinorSnapshot: rate ?? 0,
    currencySnapshot: settings.currency
  }
}

const requireEditableWeek = (week: WeeklyTimesheetRecord) => {
  if (!['DRAFT', 'REJECTED'].includes(week.status)) {
    throw createError({ statusCode: 409, message: 'Submitted or approved time cannot be changed' })
  }
}

export const getBootstrap = async (
  organizationId: string,
  userId: string,
  dateString?: string
): Promise<TimesheetBootstrapDto> => {
  const week = await ensureWeek(organizationId, userId, dateString)
  const [settings, clients, projects, activities, team, entries] = await Promise.all([
    ensureSettings(organizationId),
    listClients(organizationId),
    listProjects(organizationId),
    listActivities(organizationId),
    listTeam(organizationId),
    db.select().from(timeEntry).where(eq(timeEntry.weeklyTimesheetId, week.id))
      .orderBy(asc(timeEntry.entryDate), asc(timeEntry.createdAt))
  ])
  return {
    settings: {
      currency: settings.currency,
      timezone: settings.timezone,
      defaultVatRateBasisPoints: settings.defaultVatRateBasisPoints,
      weekStartsOn: settings.weekStartsOn
    },
    clients,
    projects,
    activities,
    team,
    week: toWeekDto(week, entries)
  }
}

export const createEntry = async (
  organizationId: string,
  userId: string,
  input: {
    projectId: string
    activityTypeId: string
    entryDate: string
    durationMinutes: number
    note?: string | null
  }
) => {
  const week = await ensureWeek(organizationId, userId, input.entryDate)
  requireEditableWeek(week)
  if (input.entryDate < week.weekStartsOn || input.entryDate > addIsoDays(week.weekStartsOn, 6)) {
    throw createError({ statusCode: 400, message: 'Entry date is outside the selected week' })
  }
  const snapshots = await resolveEntryContext(
    organizationId,
    userId,
    input.projectId,
    input.activityTypeId
  )
  const [created] = await db.insert(timeEntry).values({
    id: nanoid(),
    organizationId,
    weeklyTimesheetId: week.id,
    userId,
    ...input,
    ...snapshots
  }).returning()
  if (!created) throw createError({ statusCode: 500, message: 'Failed to create entry' })
  return toEntryDto(created)
}

export const updateEntry = async (
  organizationId: string,
  userId: string,
  id: string,
  input: Partial<{
    projectId: string
    activityTypeId: string
    entryDate: string
    durationMinutes: number
    note: string | null
  }>
) => {
  const [current] = await db.select().from(timeEntry).where(and(
    eq(timeEntry.id, id),
    eq(timeEntry.organizationId, organizationId),
    eq(timeEntry.userId, userId)
  )).limit(1)
  if (!current) throw createError({ statusCode: 404, message: 'Time entry not found' })
  const [week] = await db.select().from(weeklyTimesheet)
    .where(eq(weeklyTimesheet.id, current.weeklyTimesheetId)).limit(1)
  if (!week) throw createError({ statusCode: 404, message: 'Timesheet week not found' })
  requireEditableWeek(week)
  if (current.timerStartedAt) throw createError({ statusCode: 409, message: 'Stop the timer before editing' })
  const projectId = input.projectId ?? current.projectId
  const activityTypeId = input.activityTypeId ?? current.activityTypeId
  const entryDate = input.entryDate ?? current.entryDate
  if (entryDate < week.weekStartsOn || entryDate > addIsoDays(week.weekStartsOn, 6)) {
    throw createError({ statusCode: 400, message: 'Entry date is outside the selected week' })
  }
  const snapshots = await resolveEntryContext(organizationId, userId, projectId, activityTypeId)
  const [updated] = await db.update(timeEntry).set({ ...input, ...snapshots }).where(
    eq(timeEntry.id, id)
  ).returning()
  if (!updated) throw createError({ statusCode: 500, message: 'Failed to update entry' })
  return toEntryDto(updated)
}

export const deleteEntry = async (organizationId: string, userId: string, id: string) => {
  const [current] = await db.select().from(timeEntry).where(and(
    eq(timeEntry.id, id),
    eq(timeEntry.organizationId, organizationId),
    eq(timeEntry.userId, userId)
  )).limit(1)
  if (!current) throw createError({ statusCode: 404, message: 'Time entry not found' })
  const [week] = await db.select().from(weeklyTimesheet)
    .where(eq(weeklyTimesheet.id, current.weeklyTimesheetId)).limit(1)
  if (!week) throw createError({ statusCode: 404, message: 'Timesheet week not found' })
  requireEditableWeek(week)
  await db.delete(timeEntry).where(eq(timeEntry.id, id))
}

export const startTimer = async (
  organizationId: string,
  userId: string,
  input: { projectId: string, activityTypeId: string, entryDate: string, note?: string | null }
) => {
  const [running] = await db.select().from(timeEntry).where(and(
    eq(timeEntry.organizationId, organizationId),
    eq(timeEntry.userId, userId),
    isNotNull(timeEntry.timerStartedAt)
  )).limit(1)
  if (running) throw createError({ statusCode: 409, message: 'Another timer is already running' })
  const week = await ensureWeek(organizationId, userId, input.entryDate)
  requireEditableWeek(week)
  const snapshots = await resolveEntryContext(
    organizationId,
    userId,
    input.projectId,
    input.activityTypeId
  )
  const [created] = await db.insert(timeEntry).values({
    id: nanoid(),
    organizationId,
    weeklyTimesheetId: week.id,
    userId,
    ...input,
    durationMinutes: 0,
    timerStartedAt: new Date(),
    ...snapshots
  }).returning()
  if (!created) throw createError({ statusCode: 500, message: 'Failed to start timer' })
  return toEntryDto(created)
}

export const stopTimer = async (organizationId: string, userId: string) => {
  const [running] = await db.select().from(timeEntry).where(and(
    eq(timeEntry.organizationId, organizationId),
    eq(timeEntry.userId, userId),
    isNotNull(timeEntry.timerStartedAt)
  )).limit(1)
  if (!running?.timerStartedAt) throw createError({ statusCode: 404, message: 'No timer is running' })
  const elapsed = Math.max(1, Math.round((Date.now() - running.timerStartedAt.getTime()) / 60_000))
  const [updated] = await db.update(timeEntry).set({
    durationMinutes: elapsed,
    timerStartedAt: null
  }).where(eq(timeEntry.id, running.id)).returning()
  if (!updated) throw createError({ statusCode: 500, message: 'Failed to stop timer' })
  return toEntryDto(updated)
}

export const submitWeek = async (organizationId: string, userId: string, weekId: string) =>
  db.transaction(async (tx) => {
    const [week] = await tx.select().from(weeklyTimesheet).where(and(
      eq(weeklyTimesheet.id, weekId),
      eq(weeklyTimesheet.organizationId, organizationId),
      eq(weeklyTimesheet.userId, userId)
    )).limit(1)
    if (!week) throw createError({ statusCode: 404, message: 'Timesheet week not found' })
    requireEditableWeek(week)
    const entries = await tx.select().from(timeEntry)
      .where(eq(timeEntry.weeklyTimesheetId, week.id))
    if (!entries.length) throw createError({ statusCode: 422, message: 'An empty week cannot be submitted' })
    if (entries.some(entry => entry.timerStartedAt)) {
      throw createError({ statusCode: 409, message: 'Stop the running timer before submitting' })
    }
    const now = new Date()
    const [updated] = await tx.update(weeklyTimesheet).set({
      status: 'SUBMITTED',
      submittedAt: now,
      reviewedAt: null,
      reviewedById: null,
      rejectionComment: null
    }).where(eq(weeklyTimesheet.id, week.id)).returning()
    await tx.insert(timesheetApprovalHistory).values({
      id: nanoid(),
      weeklyTimesheetId: week.id,
      action: 'SUBMITTED',
      actorUserId: userId
    })
    return updated
  })

export const listApprovalQueue = async (organizationId: string): Promise<ApprovalQueueItemDto[]> => {
  const [weeks, members, settings] = await Promise.all([
    db.select().from(weeklyTimesheet).where(and(
      eq(weeklyTimesheet.organizationId, organizationId),
      inArray(weeklyTimesheet.status, ['SUBMITTED', 'APPROVED', 'REJECTED'])
    )).orderBy(desc(weeklyTimesheet.weekStartsOn)),
    listPortalOrganizationMembers(organizationId),
    ensureSettings(organizationId)
  ])
  if (!weeks.length) return []
  const entries = await db.select().from(timeEntry)
    .where(inArray(timeEntry.weeklyTimesheetId, weeks.map(week => week.id)))
    .orderBy(asc(timeEntry.entryDate), asc(timeEntry.createdAt))
  const clientReviews = await db.select().from(timesheetClientReview)
    .where(inArray(timesheetClientReview.weeklyTimesheetId, weeks.map(week => week.id)))
  const names = new Map(members.map(member => [member.id, member.name]))
  return weeks.map((week) => {
    const weekEntries = entries.filter(entry => entry.weeklyTimesheetId === week.id)
    return {
      id: week.id,
      userId: week.userId,
      userName: names.get(week.userId) ?? 'Unknown member',
      weekStartsOn: week.weekStartsOn,
      status: week.status,
      totalMinutes: weekEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      billableMinutes: weekEntries.filter(entry => entry.billableSnapshot)
        .reduce((sum, entry) => sum + entry.durationMinutes, 0),
      billableAmountMinor: weekEntries.reduce((sum, entry) =>
        sum + Math.round(entry.durationMinutes * entry.hourlyRateMinorSnapshot / 60), 0),
      currency: settings.currency,
      submittedAt: week.submittedAt?.toISOString() ?? null,
      entries: weekEntries.map(toEntryDto),
      clientReviews: clientReviews.filter(review => review.weeklyTimesheetId === week.id).map(review => ({ clientOrganizationId: review.clientOrganizationId, status: review.status, comment: review.comment }))
    }
  })
}

export const reviewWeek = async (
  organizationId: string,
  actorUserId: string,
  weekId: string,
  action: 'APPROVE' | 'REJECT' | 'REOPEN',
  comment?: string | null
) => db.transaction(async (tx) => {
  const [week] = await tx.select().from(weeklyTimesheet).where(and(
    eq(weeklyTimesheet.id, weekId),
    eq(weeklyTimesheet.organizationId, organizationId)
  )).limit(1)
  if (!week) throw createError({ statusCode: 404, message: 'Timesheet week not found' })
  if (action !== 'REOPEN' && week.status !== 'SUBMITTED') {
    throw createError({ statusCode: 409, message: 'Only submitted weeks can be reviewed' })
  }
  if (action === 'REOPEN' && week.status !== 'APPROVED') {
    throw createError({ statusCode: 409, message: 'Only approved weeks can be reopened' })
  }
  if (action === 'REOPEN') {
    const [invoicedEntry] = await tx.select({ id: invoiceTimeEntry.id }).from(invoiceTimeEntry)
      .innerJoin(timeEntry, eq(timeEntry.id, invoiceTimeEntry.timeEntryId))
      .innerJoin(invoice, eq(invoice.id, invoiceTimeEntry.invoiceId))
      .where(and(
        eq(timeEntry.weeklyTimesheetId, week.id),
        inArray(invoice.status, ['DRAFT', 'ISSUED', 'PAID'])
      )).limit(1)
    if (invoicedEntry) throw createError({ statusCode: 409, message: 'Invoiced timesheets cannot be reopened' })
  }
  const now = new Date()
  const nextStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'DRAFT'
  const [updated] = await tx.update(weeklyTimesheet).set({
    status: nextStatus,
    reviewedAt: action === 'REOPEN' ? null : now,
    reviewedById: action === 'REOPEN' ? null : actorUserId,
    rejectionComment: action === 'REJECT' ? comment : null
  }).where(eq(weeklyTimesheet.id, week.id)).returning()
  await tx.insert(timesheetApprovalHistory).values({
    id: nanoid(),
    weeklyTimesheetId: week.id,
    action: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'REOPENED',
    actorUserId,
    comment
  })
  if (action === 'APPROVE') {
    const representedClients = await tx.selectDistinct({ clientOrganizationId: timeEntry.clientOrganizationId })
      .from(timeEntry)
      .innerJoin(workspaceClient, and(
        eq(workspaceClient.workspaceOrganizationId, organizationId),
        eq(workspaceClient.clientOrganizationId, timeEntry.clientOrganizationId),
        eq(workspaceClient.accessMode, 'REVIEW')
      ))
      .where(eq(timeEntry.weeklyTimesheetId, week.id))
    if (representedClients.length) {
      await tx.insert(timesheetClientReview).values(representedClients.map(item => ({
        id: nanoid(),
        weeklyTimesheetId: week.id,
        clientOrganizationId: item.clientOrganizationId,
        status: 'PENDING' as const
      }))).onConflictDoNothing()
    }
  }
  if (action === 'REOPEN') {
    await tx.update(timesheetClientReview).set({
      status: 'PENDING',
      reviewerUserId: null,
      comment: null,
      reviewedAt: null,
      version: sql`${timesheetClientReview.version} + 1`,
      updatedAt: now
    }).where(eq(timesheetClientReview.weeklyTimesheetId, week.id))
  }
  return updated
})

export const getReport = async (
  organizationId: string,
  filters: ReportQuery
): Promise<TimesheetReportDto> => {
  const conditions = [eq(timeEntry.organizationId, organizationId)]
  if (filters.from) conditions.push(gte(timeEntry.entryDate, filters.from))
  if (filters.to) conditions.push(lte(timeEntry.entryDate, filters.to))
  if (filters.projectId) conditions.push(eq(timeEntry.projectId, filters.projectId))
  if (filters.userId) conditions.push(eq(timeEntry.userId, filters.userId))
  if (filters.activityTypeId) conditions.push(eq(timeEntry.activityTypeId, filters.activityTypeId))
  if (filters.billable !== undefined) conditions.push(eq(timeEntry.billableSnapshot, filters.billable))

  const [entries, projects, activities, members, weeks, settings] = await Promise.all([
    db.select().from(timeEntry).where(and(...conditions)).orderBy(desc(timeEntry.entryDate)),
    listProjects(organizationId),
    listActivities(organizationId),
    listPortalOrganizationMembers(organizationId),
    db.select().from(weeklyTimesheet).where(eq(weeklyTimesheet.organizationId, organizationId)),
    ensureSettings(organizationId)
  ])
  const projectMap = new Map(projects.map(item => [item.id, item]))
  const activityMap = new Map(activities.map(item => [item.id, item]))
  const memberMap = new Map(members.map(item => [item.id, item]))
  const weekMap = new Map(weeks.map(item => [item.id, item]))
  const rows: ReportRowDto[] = entries.flatMap((entry) => {
    const selectedProject = projectMap.get(entry.projectId)
    const selectedWeek = weekMap.get(entry.weeklyTimesheetId)
    if (!selectedProject || !selectedWeek) return []
    if (filters.clientOrganizationId
      && selectedProject.clientOrganizationId !== filters.clientOrganizationId) return []
    if (filters.status && selectedWeek.status !== filters.status) return []
    return [{
      entryId: entry.id,
      date: entry.entryDate,
      client: selectedProject.clientName,
      project: selectedProject.name,
      person: memberMap.get(entry.userId)?.name ?? 'Unknown member',
      activity: activityMap.get(entry.activityTypeId)?.name ?? 'Unknown activity',
      minutes: entry.durationMinutes,
      billable: entry.billableSnapshot,
      hourlyRateMinor: entry.hourlyRateMinorSnapshot,
      amountMinor: Math.round(entry.durationMinutes * entry.hourlyRateMinorSnapshot / 60),
      currency: entry.currencySnapshot,
      status: selectedWeek.status,
      note: entry.note
    }]
  })
  return {
    rows,
    totals: {
      minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
      billableMinutes: rows.filter(row => row.billable).reduce((sum, row) => sum + row.minutes, 0),
      nonBillableMinutes: rows.filter(row => !row.billable).reduce((sum, row) => sum + row.minutes, 0),
      billableAmountMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0),
      currency: settings.currency
    }
  }
}

export const updateSettings = async (
  organizationId: string,
  input: Partial<{ currency: string, timezone: string, defaultVatRateBasisPoints: number }>
) => {
  await ensureSettings(organizationId)
  const [updated] = await db.update(workspaceSettings).set(input)
    .where(eq(workspaceSettings.organizationId, organizationId)).returning()
  return updated
}

const invoiceTotals = (lines: Array<{ quantityMilli: number, unitPriceMinor: number, vatRateBasisPoints: number }>, payments: Array<{ amountMinor: number }>) => {
  const subtotalMinor = lines.reduce((sum, line) => sum + Math.round(line.quantityMilli * line.unitPriceMinor / 1000), 0)
  const vatMinor = lines.reduce((sum, line) => {
    const amount = Math.round(line.quantityMilli * line.unitPriceMinor / 1000)
    return sum + Math.round(amount * line.vatRateBasisPoints / 10_000)
  }, 0)
  const totalMinor = subtotalMinor + vatMinor
  const paidMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0)
  return { subtotalMinor, vatMinor, totalMinor, paidMinor, outstandingMinor: Math.max(0, totalMinor - paidMinor) }
}

export const listInvoices = async (organizationId: string): Promise<InvoiceDto[]> => {
  const [invoices, settings] = await Promise.all([
    db.select().from(invoice).where(eq(invoice.organizationId, organizationId)).orderBy(desc(invoice.issueDate), desc(invoice.createdAt)),
    ensureSettings(organizationId)
  ])
  if (!settings.invoicingEnabled) throw createError({ statusCode: 403, message: 'Invoicing is not enabled for this organization' })
  if (!invoices.length) return []
  const ids = invoices.map(item => item.id)
  const [lines, payments, deliveries] = await Promise.all([
    db.select().from(invoiceLine).where(inArray(invoiceLine.invoiceId, ids)).orderBy(asc(invoiceLine.position)),
    db.select().from(invoicePayment).where(inArray(invoicePayment.invoiceId, ids)).orderBy(desc(invoicePayment.paidOn)),
    db.select().from(invoiceEmailDelivery).where(and(
      inArray(invoiceEmailDelivery.invoiceId, ids),
      eq(invoiceEmailDelivery.purpose, 'REMINDER'),
      eq(invoiceEmailDelivery.status, 'SENT')
    )).orderBy(desc(invoiceEmailDelivery.sentAt))
  ])
  return invoices.map((item) => {
    const selectedLines = lines.filter(line => line.invoiceId === item.id)
    const selectedPayments = payments.filter(payment => payment.invoiceId === item.id)
    const totals = invoiceTotals(selectedLines, selectedPayments)
    const reminders = deliveries.filter(delivery => delivery.invoiceId === item.id)
    return {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      issuedAt: item.issuedAt?.toISOString() ?? null,
      lines: selectedLines.map(line => ({ ...line, amountMinor: Math.round(line.quantityMilli * line.unitPriceMinor / 1000) })),
      payments: selectedPayments.map(payment => ({ id: payment.id, paidOn: payment.paidOn, amountMinor: payment.amountMinor, reference: payment.reference, note: payment.note })),
      ...totals,
      ...invoiceOverdueDetails(item.dueDate, item.status, totals.outstandingMinor, settings.timezone),
      reminderCount: reminders.length,
      lastReminderSentAt: reminders[0]?.sentAt?.toISOString() ?? null
    }
  })
}

export const getInvoice = async (organizationId: string, id: string): Promise<InvoiceDto> => {
  const selected = (await listInvoices(organizationId)).find(item => item.id === id)
  if (!selected) throw createError({ statusCode: 404, message: 'Invoice not found' })
  const [historyRows, attachmentRows, deliveryRows] = await Promise.all([
    db.select({ history: invoiceHistory, actorName: user.name }).from(invoiceHistory)
      .innerJoin(user, eq(user.id, invoiceHistory.actorUserId))
      .where(eq(invoiceHistory.invoiceId, id)).orderBy(desc(invoiceHistory.createdAt)),
    db.select({ attachment: invoiceAttachment, uploaderName: user.name }).from(invoiceAttachment)
      .innerJoin(user, eq(user.id, invoiceAttachment.uploadedById))
      .where(eq(invoiceAttachment.invoiceId, id)).orderBy(desc(invoiceAttachment.createdAt)),
    db.select({ delivery: invoiceEmailDelivery, actorName: user.name }).from(invoiceEmailDelivery)
      .innerJoin(user, eq(user.id, invoiceEmailDelivery.actorUserId))
      .where(eq(invoiceEmailDelivery.invoiceId, id)).orderBy(desc(invoiceEmailDelivery.createdAt))
  ])
  return {
    ...selected,
    history: historyRows.map(({ history, actorName }) => ({
      id: history.id,
      action: history.action as NonNullable<InvoiceDto['history']>[number]['action'],
      actorName,
      amountMinor: history.amountMinor,
      attachmentName: history.attachmentName,
      createdAt: history.createdAt.toISOString()
    })),
    attachments: attachmentRows.map(({ attachment, uploaderName }) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      size: attachment.size,
      uploadedByName: uploaderName,
      createdAt: attachment.createdAt.toISOString()
    })),
    emailDeliveries: deliveryRows.map(({ delivery, actorName }) => ({
      id: delivery.id, purpose: delivery.purpose, status: delivery.status, recipientEmail: delivery.recipientEmail,
      ccEmails: JSON.parse(delivery.ccEmails) as string[], locale: delivery.locale, subject: delivery.subject,
      actorName, providerMessageId: delivery.providerMessageId, errorMessage: delivery.errorMessage,
      providerLastEvent: delivery.providerLastEvent,
      providerStatusCheckedAt: delivery.providerStatusCheckedAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(), sentAt: delivery.sentAt?.toISOString() ?? null
    }))
  }
}

export const listInvoiceableEntries = async (organizationId: string): Promise<InvoiceableEntryDto[]> => {
  const [report, weeks, linked, disputes] = await Promise.all([
    getReport(organizationId, { status: 'APPROVED', billable: true }),
    db.select({ id: weeklyTimesheet.id }).from(weeklyTimesheet).where(and(eq(weeklyTimesheet.organizationId, organizationId), eq(weeklyTimesheet.status, 'APPROVED'))),
    db.select({ timeEntryId: invoiceTimeEntry.timeEntryId }).from(invoiceTimeEntry)
      .innerJoin(invoice, eq(invoice.id, invoiceTimeEntry.invoiceId))
      .where(and(eq(invoice.organizationId, organizationId), inArray(invoice.status, ['DRAFT', 'ISSUED', 'PAID']))),
    db.select({ weeklyTimesheetId: timesheetClientReview.weeklyTimesheetId, clientOrganizationId: timesheetClientReview.clientOrganizationId })
      .from(timesheetClientReview).innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetClientReview.weeklyTimesheetId))
      .where(and(eq(weeklyTimesheet.organizationId, organizationId), eq(timesheetClientReview.status, 'DISPUTED')))
  ])
  const billed = new Set(linked.map(item => item.timeEntryId))
  const weekIds = new Set(weeks.map(item => item.id))
  if (!weekIds.size) return []
  const entries = await db.select({ id: timeEntry.id, weeklyTimesheetId: timeEntry.weeklyTimesheetId, clientOrganizationId: timeEntry.clientOrganizationId }).from(timeEntry)
    .where(and(eq(timeEntry.organizationId, organizationId), inArray(timeEntry.weeklyTimesheetId, [...weekIds])))
  const entryContext = new Map(entries.map(item => [item.id, item]))
  const disputed = new Set(disputes.map(item => `${item.weeklyTimesheetId}:${item.clientOrganizationId}`))
  return report.rows.filter((row) => {
    const entry = entryContext.get(row.entryId)
    return entry && !billed.has(row.entryId) && !disputed.has(`${entry.weeklyTimesheetId}:${entry.clientOrganizationId}`)
  }).map(row => ({ ...row, weeklyTimesheetId: entryContext.get(row.entryId)!.weeklyTimesheetId }))
}

export const getClientTimesheets = async (workspaceClientId: string, clientOrganizationId: string, userId: string, canManageReviewers: boolean): Promise<ClientTimesheetsDto> => {
  const workspaces = await listClientWorkspaces(clientOrganizationId, userId, canManageReviewers)
  const workspace = workspaces.find(item => item.id === workspaceClientId)
  if (!workspace) throw createError({ statusCode: 404, message: 'Client workspace not found' })
  if (workspace.accessMode !== 'VIEW') throw createError({ statusCode: 403, message: 'Use the timesheet approvals endpoint for review access' })
  const entries = await db.select({
    entry: timeEntry, week: weeklyTimesheet, projectName: project.name, activityName: activityType.name, personName: user.name
  }).from(timeEntry)
    .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timeEntry.weeklyTimesheetId))
    .innerJoin(project, eq(project.id, timeEntry.projectId))
    .innerJoin(activityType, eq(activityType.id, timeEntry.activityTypeId))
    .innerJoin(user, eq(user.id, timeEntry.userId))
    .where(and(eq(timeEntry.organizationId, workspace.workspaceOrganizationId), eq(timeEntry.clientOrganizationId, clientOrganizationId), eq(weeklyTimesheet.status, 'APPROVED')))
    .orderBy(desc(weeklyTimesheet.weekStartsOn), asc(timeEntry.entryDate), asc(timeEntry.createdAt))
  const weekIds = [...new Set(entries.map(item => item.week.id))]
  const entryIds = entries.map(item => item.entry.id)
  const invoicedEntries = entryIds.length
    ? await db.select({ timeEntryId: invoiceTimeEntry.timeEntryId }).from(invoiceTimeEntry)
        .innerJoin(invoice, eq(invoice.id, invoiceTimeEntry.invoiceId))
        .where(and(inArray(invoiceTimeEntry.timeEntryId, entryIds), inArray(invoice.status, ['DRAFT', 'ISSUED', 'PAID'])))
    : []
  const invoicedEntryIds = new Set(invoicedEntries.map(item => item.timeEntryId))
  const reviews = weekIds.length
    ? await db.select().from(timesheetClientReview).where(and(
        inArray(timesheetClientReview.weeklyTimesheetId, weekIds), eq(timesheetClientReview.clientOrganizationId, clientOrganizationId)
      ))
    : []
  const [internalHistory, clientHistory] = weekIds.length
    ? await Promise.all([
        db.select({ history: timesheetApprovalHistory, actorName: user.name }).from(timesheetApprovalHistory)
          .innerJoin(user, eq(user.id, timesheetApprovalHistory.actorUserId))
          .where(and(inArray(timesheetApprovalHistory.weeklyTimesheetId, weekIds), inArray(timesheetApprovalHistory.action, ['SUBMITTED', 'APPROVED', 'REOPENED']))),
        db.select({ history: timesheetClientReviewHistory, actorName: user.name }).from(timesheetClientReviewHistory)
          .innerJoin(user, eq(user.id, timesheetClientReviewHistory.actorUserId))
          .where(and(inArray(timesheetClientReviewHistory.weeklyTimesheetId, weekIds), eq(timesheetClientReviewHistory.clientOrganizationId, clientOrganizationId)))
      ])
    : [[], []]
  const reviewByWeek = new Map(reviews.map(item => [item.weeklyTimesheetId, item]))
  const slices = weekIds.map((weekId) => {
    const rows = entries.filter(item => item.week.id === weekId)
    const review = reviewByWeek.get(weekId)
    const invoicedCount = rows.filter(item => invoicedEntryIds.has(item.entry.id)).length
    return {
      weeklyTimesheetId: weekId, weekStartsOn: rows[0]!.week.weekStartsOn, person: rows[0]!.personName,
      status: review?.status ?? 'PENDING' as const,
      billingStatus: invoicedCount === 0 ? 'AWAITING_INVOICE' as const : invoicedCount === rows.length ? 'INVOICED' as const : 'PARTIALLY_INVOICED' as const,
      version: review?.version ?? 0, comment: review?.comment ?? null,
      reviewedAt: review?.reviewedAt?.toISOString() ?? null,
      entries: rows.map(({ entry, projectName, activityName, personName }) => ({ id: entry.id, date: entry.entryDate, project: projectName, person: personName, activity: activityName, minutes: entry.durationMinutes, note: entry.note })),
      history: [
        ...internalHistory.filter(item => item.history.weeklyTimesheetId === weekId).map(item => ({ id: item.history.id, action: item.history.action === 'SUBMITTED' ? 'SUBMITTED' as const : item.history.action === 'REOPENED' ? 'REOPENED' as const : 'APPROVED_INTERNAL' as const, actorName: item.actorName, comment: null, createdAt: item.history.createdAt.toISOString() })),
        ...clientHistory.filter(item => item.history.weeklyTimesheetId === weekId).map(item => ({ id: item.history.id, action: item.history.action === 'APPROVED' ? 'APPROVED_CLIENT' as const : 'DISPUTED_CLIENT' as const, actorName: item.actorName, comment: item.history.comment, createdAt: item.history.createdAt.toISOString() }))
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
  })
  return { workspace, slices }
}

export const reviewClientTimesheet = async (workspaceClientId: string, clientOrganizationId: string, actorUserId: string, isAdmin: boolean, weekId: string, action: 'APPROVE' | 'DISPUTE', expectedVersion: number, comment?: string | null) => db.transaction(async (tx) => {
  const [link] = await tx.select().from(workspaceClient).where(and(eq(workspaceClient.id, workspaceClientId), eq(workspaceClient.clientOrganizationId, clientOrganizationId), eq(workspaceClient.accessMode, 'REVIEW'))).limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'Review-enabled client workspace not found' })
  const [reviewer] = await tx.select().from(workspaceClientReviewer).where(and(eq(workspaceClientReviewer.workspaceClientId, workspaceClientId), eq(workspaceClientReviewer.userId, actorUserId))).limit(1)
  if (!isAdmin && !reviewer) throw createError({ statusCode: 403, message: 'Client reviewer access required' })
  const [eligible] = await tx.select({ id: timeEntry.id }).from(timeEntry).innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timeEntry.weeklyTimesheetId)).where(and(
    eq(timeEntry.weeklyTimesheetId, weekId), eq(timeEntry.organizationId, link.workspaceOrganizationId), eq(timeEntry.clientOrganizationId, clientOrganizationId), eq(weeklyTimesheet.status, 'APPROVED')
  )).limit(1)
  if (!eligible) throw createError({ statusCode: 404, message: 'Client timesheet slice not found' })
  const now = new Date()
  const [updated] = await tx.update(timesheetClientReview).set({ status: action === 'APPROVE' ? 'APPROVED' : 'DISPUTED', reviewerUserId: actorUserId, comment: comment ?? null, reviewedAt: now, version: expectedVersion + 1, updatedAt: now }).where(and(
    eq(timesheetClientReview.weeklyTimesheetId, weekId), eq(timesheetClientReview.clientOrganizationId, clientOrganizationId), eq(timesheetClientReview.status, 'PENDING'), eq(timesheetClientReview.version, expectedVersion)
  )).returning()
  if (!updated) throw createError({ statusCode: 409, message: 'Client review changed; refresh and try again' })
  await tx.insert(timesheetClientReviewHistory).values({ id: nanoid(), weeklyTimesheetId: weekId, clientOrganizationId, action: action === 'APPROVE' ? 'APPROVED' : 'DISPUTED', actorUserId, comment: comment ?? null, createdAt: now })
  return updated
})

export const getNextInvoiceNumber = async (organizationId: string): Promise<string> => {
  await requireInvoicingEnabled(organizationId)
  const existing = await db.select({ number: invoice.number }).from(invoice)
    .where(eq(invoice.organizationId, organizationId))
    .orderBy(desc(invoice.createdAt))
  if (!existing.length) return firstInvoiceNumber()
  const used = new Set(existing.map(item => item.number))
  const latestSequential = existing.find(item => hasNumericInvoiceSequence(item.number))
  let candidate = latestSequential ? incrementInvoiceNumber(latestSequential.number) : firstInvoiceNumber()
  while (used.has(candidate)) candidate = incrementInvoiceNumber(candidate)
  return candidate
}

export const createInvoice = async (organizationId: string, actorUserId: string, input: {
  clientOrganizationId: string
  contactId?: string | null
  number: string
  currency: string
  issueDate: string
  dueDate: string
  subject?: string | null
  notes?: string | null
  lines: Array<{
    description: string
    quantityMilli: number
    unit: string
    unitPriceMinor: number
    vatRateBasisPoints: number
    timeEntryIds?: string[]
  }>
}) => db.transaction(async (tx) => {
  const [duplicate] = await tx.select({ id: invoice.id }).from(invoice)
    .where(and(eq(invoice.organizationId, organizationId), eq(invoice.number, input.number))).limit(1)
  if (duplicate) throw createError({ statusCode: 409, message: 'Invoice number already exists' })
  const clients = await listClients(organizationId)
  const client = clients.find(item => item.organizationId === input.clientOrganizationId)
  if (!client) throw createError({ statusCode: 400, message: 'Client is not linked to this workspace' })
  const sender = await getOrganizationInvoiceProfile(organizationId)
  if (![sender.address, sender.registrationNumber, sender.vatNumber, sender.iban, sender.bic, sender.invoiceEmail].every(value => value?.trim())) {
    throw createError({ statusCode: 409, message: 'Sender invoice details must be completed before creating an invoice' })
  }
  const contact = input.contactId ? client.contacts.find(item => item.id === input.contactId) : undefined
  if (input.contactId && !contact) throw createError({ statusCode: 400, message: 'Contact does not belong to this client' })
  const sourceIds = input.lines.flatMap(line => line.timeEntryIds ?? [])
  if (new Set(sourceIds).size !== sourceIds.length) throw createError({ statusCode: 400, message: 'A time entry can only occur once on an invoice' })
  if (sourceIds.length) {
    const [entries, existing] = await Promise.all([
      tx.select({ entry: timeEntry, weekStatus: weeklyTimesheet.status }).from(timeEntry).innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timeEntry.weeklyTimesheetId)).where(and(eq(timeEntry.organizationId, organizationId), inArray(timeEntry.id, sourceIds))),
      tx.select({ id: invoiceTimeEntry.timeEntryId }).from(invoiceTimeEntry)
        .innerJoin(invoice, eq(invoice.id, invoiceTimeEntry.invoiceId))
        .where(and(inArray(invoiceTimeEntry.timeEntryId, sourceIds), inArray(invoice.status, ['DRAFT', 'ISSUED', 'PAID'])))
    ])
    if (entries.length !== sourceIds.length || entries.some(row => row.weekStatus !== 'APPROVED' || !row.entry.billableSnapshot || row.entry.currencySnapshot !== input.currency) || existing.length) {
      throw createError({ statusCode: 409, message: 'One or more time entries are unavailable for invoicing' })
    }
    const byId = new Map(entries.map(row => [row.entry.id, row.entry]))
    for (const line of input.lines.filter(line => line.timeEntryIds?.length)) {
      const sources = line.timeEntryIds!.map(id => byId.get(id)!)
      if (new Set(sources.map(entry => entry.hourlyRateMinorSnapshot)).size !== 1
        || line.unitPriceMinor !== sources[0]!.hourlyRateMinorSnapshot
        || line.quantityMilli !== Math.round(sources.reduce((sum, entry) => sum + entry.durationMinutes, 0) * 1000 / 60)) {
        throw createError({ statusCode: 400, message: 'Timesheet invoice line totals do not match their source entries' })
      }
    }
  }
  const invoiceId = nanoid()
  const { lines, contactId: _contactId, ...values } = input
  const snapshots = { senderName: sender.name, senderLogo: sender.logo, senderAddress: sender.address, senderRegistration: sender.registrationNumber,
    senderVatNumber: sender.vatNumber, senderIban: sender.iban, senderBic: sender.bic, recipientName: client.officialName || client.name,
    recipientAddress: client.address, recipientContactName: contact?.name ?? null, recipientEmail: contact?.email ?? client.invoiceEmail,
    recipientLocale: client.preferredLocale }
  const [created] = await tx.insert(invoice).values({ id: invoiceId, organizationId, createdById: actorUserId, ...values, ...snapshots }).returning()
  await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId, action: 'CREATED', actorUserId })
  for (const [position, line] of lines.entries()) {
    const lineId = nanoid()
    const { timeEntryIds = [], ...lineValues } = line
    await tx.insert(invoiceLine).values({ id: lineId, invoiceId, position, ...lineValues })
    if (timeEntryIds.length) await tx.insert(invoiceTimeEntry).values(timeEntryIds.map(timeEntryId => ({ id: nanoid(), invoiceId, invoiceLineId: lineId, timeEntryId })))
  }
  return created
})

export const changeInvoiceStatus = async (organizationId: string, actorUserId: string, id: string, action: 'ISSUE' | 'VOID' | 'UNVOID') => db.transaction(async (tx) => {
  const [current] = await tx.select().from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).limit(1)
  if (!current) throw createError({ statusCode: 404, message: 'Invoice not found' })
  if (action === 'ISSUE' && current.status !== 'DRAFT') throw createError({ statusCode: 409, message: 'Only draft invoices can be issued' })
  if (action === 'VOID' && !['DRAFT', 'ISSUED'].includes(current.status)) throw createError({ statusCode: 409, message: 'This invoice cannot be voided' })
  if (action === 'UNVOID' && current.status !== 'VOID') throw createError({ statusCode: 409, message: 'Only voided invoices can be unvoided' })
  const status = action === 'ISSUE' ? 'ISSUED' : action === 'VOID' ? 'VOID' : current.issuedAt ? 'ISSUED' : 'DRAFT'
  const [updated] = await tx.update(invoice).set({ status, issuedAt: action === 'ISSUE' ? new Date() : current.issuedAt }).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).returning()
  const historyAction = action === 'ISSUE' ? 'ISSUED' : action === 'VOID' ? 'VOIDED' : 'UNVOIDED'
  await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: historyAction, actorUserId })
  return updated
})

export const updateInvoice = async (organizationId: string, actorUserId: string, id: string, input: { number: string, issueDate: string, dueDate: string, subject?: string | null, notes?: string | null }) => db.transaction(async (tx) => {
  const [current] = await tx.select().from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).limit(1)
  if (!current) throw createError({ statusCode: 404, message: 'Invoice not found' })
  if (current.status !== 'DRAFT') throw createError({ statusCode: 409, message: 'Only draft invoices can be edited' })
  const [duplicate] = await tx.select({ id: invoice.id }).from(invoice)
    .where(and(eq(invoice.organizationId, organizationId), eq(invoice.number, input.number))).limit(1)
  if (duplicate && duplicate.id !== id) throw createError({ statusCode: 409, message: 'Invoice number already exists' })
  const [[sender], [recipient]] = await Promise.all([
    tx.select({ logo: organization.logo }).from(organization)
      .where(eq(organization.id, organizationId)).limit(1),
    current.clientOrganizationId
      ? tx.select({
          name: organization.name,
          metadata: organization.metadata,
          address: organizationInvoiceProfile.address,
          preferredLocale: organizationInvoiceProfile.preferredLocale
        }).from(organization)
          .leftJoin(organizationInvoiceProfile, eq(organizationInvoiceProfile.organizationId, organization.id))
          .where(eq(organization.id, current.clientOrganizationId)).limit(1)
      : Promise.resolve([])
  ])
  if (!sender) throw createError({ statusCode: 404, message: 'Organization not found' })
  if (current.clientOrganizationId && !recipient) throw createError({ statusCode: 409, message: 'Client organization is no longer available' })

  let officialRecipientName = ''
  try {
    const metadata = recipient?.metadata ? JSON.parse(recipient.metadata) as Record<string, unknown> : {}
    if (typeof metadata.officialCompanyName === 'string') officialRecipientName = metadata.officialCompanyName.trim()
  } catch { /* Use the regular organization name for legacy metadata. */ }

  const recipientSnapshot = recipient
    ? {
        recipientName: officialRecipientName || recipient.name.trim() || current.recipientName,
        recipientAddress: recipient.address?.trim() || current.recipientAddress,
        recipientLocale: recipient.preferredLocale || current.recipientLocale
      }
    : {}
  const [updated] = await tx.update(invoice).set({ ...input, senderLogo: sender.logo, ...recipientSnapshot }).where(eq(invoice.id, id)).returning()
  await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'EDITED', actorUserId })
  return updated
})

export const registerInvoicePayment = async (organizationId: string, actorUserId: string, id: string, input: { paidOn: string, amountMinor: number, reference?: string | null, note?: string | null }) => db.transaction(async (tx) => {
  const [current] = await tx.select().from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).limit(1)
  if (!current) throw createError({ statusCode: 404, message: 'Invoice not found' })
  if (!['ISSUED', 'PAID'].includes(current.status)) throw createError({ statusCode: 409, message: 'Payments can only be registered for issued invoices' })
  const lines = await tx.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, id))
  const payments = await tx.select().from(invoicePayment).where(eq(invoicePayment.invoiceId, id))
  const totals = invoiceTotals(lines, payments)
  if (input.amountMinor > totals.outstandingMinor) throw createError({ statusCode: 400, message: 'Payment exceeds the outstanding amount' })
  const [created] = await tx.insert(invoicePayment).values({ id: nanoid(), invoiceId: id, createdById: actorUserId, ...input }).returning()
  await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'PAYMENT_REGISTERED', actorUserId, amountMinor: input.amountMinor })
  if (input.amountMinor === totals.outstandingMinor) await tx.update(invoice).set({ status: 'PAID' }).where(eq(invoice.id, id))
  return created
})

export const addInvoiceAttachment = async (organizationId: string, actorUserId: string, id: string, file: { fileName: string, contentType: string, data: Uint8Array }) => db.transaction(async (tx) => {
  const [current] = await tx.select({ id: invoice.id }).from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).limit(1)
  if (!current) throw createError({ statusCode: 404, message: 'Invoice not found' })
  if (!file.data.length || file.data.length > 10 * 1024 * 1024) throw createError({ statusCode: 400, message: 'Attachment must be between 1 byte and 10 MB' })
  const attachmentId = nanoid()
  const [created] = await tx.insert(invoiceAttachment).values({ id: attachmentId, invoiceId: id, fileName: file.fileName, contentType: file.contentType, size: file.data.length, contentBase64: Buffer.from(file.data).toString('base64'), uploadedById: actorUserId }).returning()
  await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'ATTACHMENT_ADDED', actorUserId, attachmentName: file.fileName })
  return created
})

export const getInvoiceAttachment = async (organizationId: string, invoiceId: string, attachmentId: string) => {
  const [row] = await db.select({ attachment: invoiceAttachment }).from(invoiceAttachment)
    .innerJoin(invoice, eq(invoice.id, invoiceAttachment.invoiceId))
    .where(and(eq(invoice.organizationId, organizationId), eq(invoice.id, invoiceId), eq(invoiceAttachment.id, attachmentId))).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Attachment not found' })
  return row.attachment
}

export const deleteInvoiceAttachment = async (organizationId: string, actorUserId: string, invoiceId: string, attachmentId: string) => db.transaction(async (tx) => {
  const [row] = await tx.select({ attachment: invoiceAttachment }).from(invoiceAttachment)
    .innerJoin(invoice, eq(invoice.id, invoiceAttachment.invoiceId))
    .where(and(eq(invoice.organizationId, organizationId), eq(invoice.id, invoiceId), eq(invoiceAttachment.id, attachmentId))).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Attachment not found' })
  await tx.delete(invoiceAttachment).where(eq(invoiceAttachment.id, attachmentId))
  await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId, action: 'ATTACHMENT_REMOVED', actorUserId, attachmentName: row.attachment.fileName })
})

export const reportToCsv = (report: TimesheetReportDto) => {
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [
    ['Date', 'Client', 'Project', 'Person', 'Activity', 'Hours', 'Billable', 'Rate', 'Amount', 'Currency', 'Status', 'Note'],
    ...report.rows.map(row => [
      row.date,
      row.client,
      row.project,
      row.person,
      row.activity,
      (row.minutes / 60).toFixed(2),
      row.billable ? 'Yes' : 'No',
      (row.hourlyRateMinor / 100).toFixed(2),
      (row.amountMinor / 100).toFixed(2),
      row.currency,
      row.status,
      row.note ?? ''
    ])
  ].map(row => row.map(quote).join(',')).join('\n')
}
