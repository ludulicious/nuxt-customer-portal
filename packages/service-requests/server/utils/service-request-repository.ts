import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'
import { db, listPortalOrganizationMembers } from '@nuxt-customer-portal/core/server/portal'
import { organization, user } from '@nuxt-customer-portal/core/schema'
import {
  serviceRequest, serviceRequestActivity, serviceRequestAttachment, serviceRequestQuote, serviceRequestQuoteLine,
  type NewServiceRequestRecord, type ServiceRequestRecord
} from '@nuxt-customer-portal/service-requests/server/db/schema/service-requests'
import type {
  ServiceRequestActivityType, ServiceRequestDashboardDto, ServiceRequestDto, ServiceRequestListResponse,
  ServiceRequestQuoteCreateInput, ServiceRequestQuoteDto, ServiceRequestStatus
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'
import type { ServiceRequestQuery } from './service-request-validation'

const clientOrganization = alias(organization, 'service_request_client_organization')
const assignee = alias(user, 'service_request_assignee')
const activeStatuses: ServiceRequestStatus[] = ['NEW', 'EVALUATING', 'AWAITING_APPROVAL', 'ACCEPTED', 'IN_PROGRESS']
export const serviceRequestTransitions: Record<ServiceRequestStatus, readonly ServiceRequestStatus[]> = {
  NEW: ['EVALUATING', 'DECLINED', 'CANCELLED'],
  EVALUATING: ['AWAITING_APPROVAL', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
  AWAITING_APPROVAL: ['EVALUATING', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], DECLINED: [], CANCELLED: []
}

export const toServiceRequestDto = (
  row: ServiceRequestRecord,
  clientName?: string,
  assignedToName?: string | null
): ServiceRequestDto => ({
  id: row.id, title: row.title, description: row.description,
  contactName: row.contactName, contactEmail: row.contactEmail, contactPhone: row.contactPhone,
  requestedDate: row.requestedDate, serviceLocation: row.serviceLocation,
  status: row.status, priority: row.priority, category: row.category, organizationId: row.organizationId,
  clientOrganizationId: row.clientOrganizationId, ...(clientName ? { clientName } : {}),
  createdById: row.createdById, assignedToId: row.assignedToId,
  ...(assignedToName !== undefined ? { assignedToName } : {}), internalNotes: row.internalNotes,
  attachments: [], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  evaluatingAt: row.evaluatingAt?.toISOString() ?? null, acceptedAt: row.acceptedAt?.toISOString() ?? null,
  startedAt: row.startedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null,
  declinedAt: row.declinedAt?.toISOString() ?? null, cancelledAt: row.cancelledAt?.toISOString() ?? null
})

const filterConditions = (organizationId: string, filters: ServiceRequestQuery, scope?: { clientOrganizationId?: string; createdById?: string }): SQL[] => {
  const conditions: SQL[] = [eq(serviceRequest.organizationId, organizationId)]
  if (scope?.clientOrganizationId) {
conditions.push(eq(serviceRequest.clientOrganizationId, scope.clientOrganizationId))
}
  if (scope?.createdById) {
conditions.push(eq(serviceRequest.createdById, scope.createdById))
}
  if (filters.clientOrganizationId) {
conditions.push(eq(serviceRequest.clientOrganizationId, filters.clientOrganizationId))
}
  if (filters.status) {
conditions.push(eq(serviceRequest.status, filters.status))
}
  if (filters.priority) {
conditions.push(eq(serviceRequest.priority, filters.priority))
}
  if (filters.category) {
conditions.push(eq(serviceRequest.category, filters.category))
}
  if (filters.assignedToId === 'unassigned') {
conditions.push(sql`${serviceRequest.assignedToId} is null`)
} else if (filters.assignedToId) {
conditions.push(eq(serviceRequest.assignedToId, filters.assignedToId))
}
  if (filters.createdById) {
conditions.push(eq(serviceRequest.createdById, filters.createdById))
}
  if (filters.search) {
conditions.push(or(
    ilike(serviceRequest.title, `%${filters.search}%`), ilike(serviceRequest.description, `%${filters.search}%`),
    ilike(serviceRequest.contactName, `%${filters.search}%`), ilike(serviceRequest.serviceLocation, `%${filters.search}%`)
  )!)
}
  return conditions
}

export const listServiceRequests = async (organizationId: string, filters: ServiceRequestQuery, scope?: { clientOrganizationId?: string; createdById?: string }): Promise<ServiceRequestListResponse> => {
  const where = and(...filterConditions(organizationId, filters, scope))
  const priorityRank = sql<number>`case ${serviceRequest.priority} when 'URGENT' then 4 when 'HIGH' then 3 when 'MEDIUM' then 2 else 1 end`
  const orderExpression = filters.sortBy === 'status' ? serviceRequest.status : filters.sortBy === 'priority' ? priorityRank : filters.sortBy === 'requestedDate' ? serviceRequest.requestedDate : serviceRequest.createdAt
  const [rows, total] = await Promise.all([
    db.select({ request: serviceRequest, clientName: clientOrganization.name, assignedToName: assignee.name })
      .from(serviceRequest).innerJoin(clientOrganization, eq(clientOrganization.id, serviceRequest.clientOrganizationId))
      .leftJoin(assignee, eq(assignee.id, serviceRequest.assignedToId)).where(where)
      .orderBy(filters.sortDir === 'asc' ? asc(orderExpression) : desc(orderExpression), asc(serviceRequest.id))
      .offset(filters.offset).limit(filters.pageSize),
    db.$count(serviceRequest, where)
  ])
  return { items: rows.map((row) => toServiceRequestDto(row.request, row.clientName, row.assignedToName)), pagination: { total, page: filters.page, pageSize: filters.pageSize, pageCount: Math.ceil(total / filters.pageSize) } }
}

export const findServiceRequest = async (id: string) => (await db.select().from(serviceRequest).where(eq(serviceRequest.id, id)).limit(1))[0]
export const createServiceRequest = async (values: NewServiceRequestRecord) => db.transaction(async (tx) => {
  const [row] = await tx.insert(serviceRequest).values(values).returning()
  await tx.insert(serviceRequestActivity).values({ id: nanoid(), requestId: values.id, type: 'CREATED', actorUserId: values.createdById })
  return row
})

const transitionTimestamps = (status: ServiceRequestStatus) => ({
  ...(status === 'EVALUATING' ? { evaluatingAt: new Date() } : {}),
  ...(status === 'ACCEPTED' ? { acceptedAt: new Date() } : {}),
  ...(status === 'IN_PROGRESS' ? { startedAt: new Date() } : {}),
  ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
  ...(status === 'DECLINED' ? { declinedAt: new Date() } : {}),
  ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {})
})

export const updateServiceRequest = async (id: string, values: Partial<NewServiceRequestRecord>, actorUserId?: string) => db.transaction(async (tx) => {
  const [existing] = await tx.select().from(serviceRequest).where(eq(serviceRequest.id, id)).limit(1)
  if (!existing) {
return undefined
}
  if (values.status && values.status !== existing.status && !serviceRequestTransitions[existing.status].includes(values.status)) {
    throw createError({ statusCode: 409, message: `Cannot move request from ${existing.status} to ${values.status}` })
  }
  if (values.assignedToId) {
    const members = await listPortalOrganizationMembers(existing.organizationId)
    if (!members.some((member) => member.id === values.assignedToId)) {
throw createError({ statusCode: 400, message: 'Assignee must be an organization member' })
}
  }
  const [row] = await tx.update(serviceRequest).set({ ...values, ...(values.status ? transitionTimestamps(values.status) : {}) }).where(eq(serviceRequest.id, id)).returning()
  if (actorUserId) {
    const type: ServiceRequestActivityType = values.status && values.status !== existing.status ? 'STATUS_CHANGED' : values.assignedToId !== undefined && values.assignedToId !== existing.assignedToId ? 'ASSIGNED' : 'DETAILS_UPDATED'
    await tx.insert(serviceRequestActivity).values({ id: nanoid(), requestId: id, actorUserId, type, metadata: JSON.stringify(type === 'STATUS_CHANGED' ? { from: existing.status, to: values.status } : {}) })
  }
  return row
})

export const addServiceRequestComment = async (requestId: string, actorUserId: string, body: string) => {
  const [row] = await db.insert(serviceRequestActivity).values({ id: nanoid(), requestId, actorUserId, type: 'COMMENT', body }).returning()
  return row
}

export const addServiceRequestAttachment = async (requestId: string, actorUserId: string, file: { fileName: string; contentType: string; size: number; contentBase64: string }) => db.transaction(async (tx) => {
  const [attachment] = await tx.insert(serviceRequestAttachment).values({ id: nanoid(), requestId, uploadedById: actorUserId, ...file }).returning()
  await tx.insert(serviceRequestActivity).values({ id: nanoid(), requestId, actorUserId, type: 'ATTACHMENT_ADDED', metadata: JSON.stringify({ attachmentId: attachment!.id, fileName: file.fileName }) })
  return { id: attachment!.id, fileName: attachment!.fileName, contentType: attachment!.contentType, size: attachment!.size, uploadedById: attachment!.uploadedById, createdAt: attachment!.createdAt.toISOString() }
})

export const getServiceRequestAttachment = async (requestId: string, attachmentId: string) => (await db.select().from(serviceRequestAttachment).where(and(eq(serviceRequestAttachment.id, attachmentId), eq(serviceRequestAttachment.requestId, requestId))).limit(1))[0]

export const removeServiceRequestAttachment = async (requestId: string, attachmentId: string, actorUserId: string) => db.transaction(async (tx) => {
  const [attachment] = await tx.select().from(serviceRequestAttachment).where(and(eq(serviceRequestAttachment.id, attachmentId), eq(serviceRequestAttachment.requestId, requestId))).limit(1)
  if (!attachment) {
throw createError({ statusCode: 404, message: 'Attachment not found' })
}
  await tx.delete(serviceRequestAttachment).where(eq(serviceRequestAttachment.id, attachmentId))
  await tx.insert(serviceRequestActivity).values({ id: nanoid(), requestId, actorUserId, type: 'ATTACHMENT_REMOVED', metadata: JSON.stringify({ attachmentId, fileName: attachment.fileName }) })
})

export const getServiceRequestDetail = async (id: string) => {
  const row = await findServiceRequest(id)
  if (!row) {
return undefined
}
  const [client, assigned, activities, attachments, quotes, lines] = await Promise.all([
    db.select({ name: organization.name }).from(organization).where(eq(organization.id, row.clientOrganizationId)).limit(1),
    row.assignedToId ? db.select({ name: user.name }).from(user).where(eq(user.id, row.assignedToId)).limit(1) : [],
    db.select({ activity: serviceRequestActivity, actorName: user.name }).from(serviceRequestActivity).innerJoin(user, eq(user.id, serviceRequestActivity.actorUserId)).where(eq(serviceRequestActivity.requestId, id)).orderBy(asc(serviceRequestActivity.createdAt)),
    db.select().from(serviceRequestAttachment).where(eq(serviceRequestAttachment.requestId, id)).orderBy(asc(serviceRequestAttachment.createdAt)),
    db.select().from(serviceRequestQuote).where(eq(serviceRequestQuote.requestId, id)).orderBy(desc(serviceRequestQuote.version)),
    db.select().from(serviceRequestQuoteLine).innerJoin(serviceRequestQuote, eq(serviceRequestQuote.id, serviceRequestQuoteLine.quoteId)).where(eq(serviceRequestQuote.requestId, id)).orderBy(asc(serviceRequestQuoteLine.position))
  ])
  const quoteDtos = quotes.map((quote) => toQuoteDto(quote, lines.filter((item) => item.service_request_quote_line.quoteId === quote.id).map((item) => item.service_request_quote_line)))
  return {
    ...toServiceRequestDto(row, client[0]?.name, assigned[0]?.name ?? null),
    attachments: attachments.map((file) => ({ id: file.id, fileName: file.fileName, contentType: file.contentType, size: file.size, uploadedById: file.uploadedById, createdAt: file.createdAt.toISOString() })),
    activities: activities.map(({ activity, actorName }) => ({ id: activity.id, type: activity.type, actorUserId: activity.actorUserId, actorName, body: activity.body, metadata: activity.metadata ? JSON.parse(activity.metadata) : null, createdAt: activity.createdAt.toISOString() })),
    quotes: quoteDtos
  }
}

const lineAmounts = (line: { quantityMilli: number; unitPriceMinor: number; vatRateBasisPoints: number }) => {
  const amountMinor = Math.round((line.quantityMilli * line.unitPriceMinor) / 1000)
  return { amountMinor, vatMinor: Math.round((amountMinor * line.vatRateBasisPoints) / 10_000) }
}
export const toQuoteDto = (quote: typeof serviceRequestQuote.$inferSelect, lines: Array<typeof serviceRequestQuoteLine.$inferSelect>): ServiceRequestQuoteDto => {
  const dtoLines = lines.map((line) => ({ ...line, ...lineAmounts(line) }))
  const subtotalMinor = dtoLines.reduce((sum, line) => sum + line.amountMinor, 0)
  const vatMinor = dtoLines.reduce((sum, line) => sum + line.vatMinor, 0)
  return { ...quote, sentAt: quote.sentAt?.toISOString() ?? null, acceptedAt: quote.acceptedAt?.toISOString() ?? null, declinedAt: quote.declinedAt?.toISOString() ?? null, createdAt: quote.createdAt.toISOString(), updatedAt: quote.updatedAt.toISOString(), lines: dtoLines, subtotalMinor, vatMinor, totalMinor: subtotalMinor + vatMinor }
}

export const createServiceRequestQuote = async (organizationId: string, requestId: string, actorUserId: string, input: ServiceRequestQuoteCreateInput) => db.transaction(async (tx) => {
  const [request] = await tx.select().from(serviceRequest).where(and(eq(serviceRequest.id, requestId), eq(serviceRequest.organizationId, organizationId))).limit(1)
  if (!request || ['COMPLETED', 'DECLINED', 'CANCELLED'].includes(request.status)) {
throw createError({ statusCode: 409, message: 'Request is not available for quoting' })
}
  const previous = await tx.select().from(serviceRequestQuote).where(eq(serviceRequestQuote.requestId, requestId)).orderBy(desc(serviceRequestQuote.version)).limit(1)
  const version = (previous[0]?.version ?? 0) + 1
  const [quote] = await tx.insert(serviceRequestQuote).values({ id: nanoid(), requestId, version, number: `Q-${new Date().getFullYear()}-${requestId.slice(0, 6)}-${version}`, status: 'DRAFT', currency: input.currency, validUntil: input.validUntil, notes: input.notes, createdById: actorUserId }).returning()
  const createdLines = await tx.insert(serviceRequestQuoteLine).values(input.lines.map((line, position) => ({ id: nanoid(), quoteId: quote!.id, position, ...line }))).returning()
  return toQuoteDto(quote!, createdLines)
})

export const sendServiceRequestQuote = async (organizationId: string, requestId: string, quoteId: string, actorUserId: string) => db.transaction(async (tx) => {
  const [request] = await tx.select().from(serviceRequest).where(and(eq(serviceRequest.id, requestId), eq(serviceRequest.organizationId, organizationId))).limit(1)
  const [quote] = await tx.select().from(serviceRequestQuote).where(and(eq(serviceRequestQuote.id, quoteId), eq(serviceRequestQuote.requestId, requestId))).limit(1)
  if (!request || !quote || quote.status !== 'DRAFT') {
throw createError({ statusCode: 409, message: 'Quote is not available for sending' })
}
  await tx.update(serviceRequestQuote).set({ status: 'SUPERSEDED' }).where(and(eq(serviceRequestQuote.requestId, requestId), eq(serviceRequestQuote.status, 'SENT')))
  const [sent] = await tx.update(serviceRequestQuote).set({ status: 'SENT', sentAt: new Date() }).where(eq(serviceRequestQuote.id, quoteId)).returning()
  if (['NEW', 'EVALUATING'].includes(request.status)) {
await tx.update(serviceRequest).set({ status: 'AWAITING_APPROVAL' }).where(eq(serviceRequest.id, requestId))
}
  await tx.insert(serviceRequestActivity).values({ id: nanoid(), requestId, actorUserId, type: 'QUOTE_SENT', metadata: JSON.stringify({ quoteId, number: quote.number }) })
  return sent
})

export const decideServiceRequestQuote = async (organizationId: string, requestId: string, quoteId: string, actorUserId: string, action: 'accept' | 'decline') => db.transaction(async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`service-request-quote:${requestId}`}))`)
  const [request] = await tx.select().from(serviceRequest).where(and(eq(serviceRequest.id, requestId), eq(serviceRequest.organizationId, organizationId))).limit(1)
  const [quote] = await tx.select().from(serviceRequestQuote).where(and(eq(serviceRequestQuote.id, quoteId), eq(serviceRequestQuote.requestId, requestId))).limit(1)
  if (!request || !quote || quote.status !== 'SENT') {
throw createError({ statusCode: 409, message: 'Quote is no longer available' })
}
  if (quote.validUntil < new Date().toISOString().slice(0, 10)) {
    await tx.update(serviceRequestQuote).set({ status: 'EXPIRED' }).where(eq(serviceRequestQuote.id, quoteId))
    throw createError({ statusCode: 409, message: 'Quote has expired' })
  }
  const accepted = action === 'accept'
  await tx.update(serviceRequestQuote).set(accepted ? { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: actorUserId } : { status: 'DECLINED', declinedAt: new Date(), declinedById: actorUserId }).where(eq(serviceRequestQuote.id, quoteId))
  await tx.update(serviceRequest).set(accepted ? { status: 'ACCEPTED', acceptedAt: new Date() } : { status: 'DECLINED', declinedAt: new Date() }).where(eq(serviceRequest.id, requestId))
  await tx.insert(serviceRequestActivity).values({ id: nanoid(), requestId, actorUserId, type: accepted ? 'QUOTE_ACCEPTED' : 'QUOTE_DECLINED', metadata: JSON.stringify({ quoteId, number: quote.number }) })
})

export const listServiceRequestAssignees = async (organizationId: string, currentAssigneeId?: string | null) => {
  const members = await listPortalOrganizationMembers(organizationId)
  const result = members.map((member) => ({ id: member.id, name: member.name, email: member.email, image: member.image, active: true }))
  if (currentAssigneeId && !result.some((member) => member.id === currentAssigneeId)) {
    const [historical] = await db.select({ id: user.id, name: user.name, email: user.email, image: user.image }).from(user).where(eq(user.id, currentAssigneeId)).limit(1)
    if (historical) {
result.push({ ...historical, active: false })
}
  }
  return result
}

export const deleteServiceRequest = async (organizationId: string, id: string) => db.transaction(async (tx) => {
  const [row] = await tx.select().from(serviceRequest).where(and(eq(serviceRequest.id, id), eq(serviceRequest.organizationId, organizationId))).limit(1)
  if (!row) {
throw createError({ statusCode: 404, message: 'Request not found' })
}
  const [activityCount, quoteCount, attachmentCount] = await Promise.all([tx.$count(serviceRequestActivity, eq(serviceRequestActivity.requestId, id)), tx.$count(serviceRequestQuote, eq(serviceRequestQuote.requestId, id)), tx.$count(serviceRequestAttachment, eq(serviceRequestAttachment.requestId, id))])
  if (row.status !== 'NEW' || activityCount > 1 || quoteCount || attachmentCount) {
throw createError({ statusCode: 409, message: 'Request has history and must be cancelled instead' })
}
  await tx.delete(serviceRequest).where(and(eq(serviceRequest.id, id), eq(serviceRequest.organizationId, organizationId)))
})

export const getServiceRequestDashboard = async (organizationId: string, canManage: boolean, scope?: { clientOrganizationId?: string; createdById?: string }): Promise<ServiceRequestDashboardDto> => {
  const result = await listServiceRequests(organizationId, { page: 1, pageSize: 100, offset: 0, sortBy: 'createdAt', sortDir: 'desc' }, scope)
  const active = result.items.filter((item) => activeStatuses.includes(item.status))
  return { overview: { activeCount: active.length, resolvedCount: result.items.length - active.length, recent: result.items.slice(0, 5) }, ...(canManage ? { attention: { urgentCount: active.filter((item) => item.priority === 'URGENT').length, unassignedCount: active.filter((item) => !item.assignedToId).length, longOpenCount: active.filter((item) => Date.now() - new Date(item.createdAt).getTime() > 604800000).length, items: active.slice(0, 5) } } : {}) }
}
