import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '#portal/server/portal'
import { serviceRequest, type NewServiceRequestRecord, type ServiceRequestRecord } from '#layers/service-requests/server/db/schema/service-requests'
import type { ServiceRequestDto, ServiceRequestListResponse } from '#layers/service-requests/shared/types/service-request'
import type { ServiceRequestQuery } from './service-request-validation'

export const toServiceRequestDto = (row: ServiceRequestRecord): ServiceRequestDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  category: row.category,
  organizationId: row.organizationId,
  createdById: row.createdById,
  assignedToId: row.assignedToId,
  attachments: row.attachments ?? [],
  internalNotes: row.internalNotes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  closedAt: row.closedAt?.toISOString() ?? null
})

const filterConditions = (organizationId: string, filters: ServiceRequestQuery): SQL[] => {
  const conditions: SQL[] = [eq(serviceRequest.organizationId, organizationId)]
  if (filters.status) conditions.push(eq(serviceRequest.status, filters.status))
  if (filters.priority) conditions.push(eq(serviceRequest.priority, filters.priority))
  if (filters.category) conditions.push(eq(serviceRequest.category, filters.category))
  if (filters.assignedToId) conditions.push(eq(serviceRequest.assignedToId, filters.assignedToId))
  if (filters.createdById) conditions.push(eq(serviceRequest.createdById, filters.createdById))
  if (filters.search) {
    const search = or(
      ilike(serviceRequest.title, `%${filters.search}%`),
      ilike(serviceRequest.description, `%${filters.search}%`)
    )
    if (search) conditions.push(search)
  }
  return conditions
}

export const listServiceRequests = async (
  organizationId: string,
  filters: ServiceRequestQuery
): Promise<ServiceRequestListResponse> => {
  const where = and(...filterConditions(organizationId, filters))
  const priorityRank = sql<number>`case
    when ${serviceRequest.priority} = 'URGENT' then 4
    when ${serviceRequest.priority} = 'HIGH' then 3
    when ${serviceRequest.priority} = 'MEDIUM' then 2
    when ${serviceRequest.priority} = 'LOW' then 1
    else 0 end`
  const orderExpression = filters.sortBy === 'status'
    ? serviceRequest.status
    : filters.sortBy === 'priority'
      ? priorityRank
      : serviceRequest.createdAt

  const [rows, total] = await Promise.all([
    db.select()
      .from(serviceRequest)
      .where(where)
      .orderBy(
        filters.sortDir === 'asc' ? asc(orderExpression) : desc(orderExpression),
        asc(serviceRequest.id)
      )
      .offset(filters.offset)
      .limit(filters.pageSize),
    db.$count(serviceRequest, where)
  ])

  return {
    items: rows.map(toServiceRequestDto),
    pagination: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: Math.ceil(total / filters.pageSize)
    }
  }
}

export const findServiceRequest = async (id: string) => {
  const [row] = await db.select().from(serviceRequest).where(eq(serviceRequest.id, id)).limit(1)
  return row
}

export const createServiceRequest = async (values: NewServiceRequestRecord) => {
  const [row] = await db.insert(serviceRequest).values(values).returning()
  return row
}

export const updateServiceRequest = async (
  id: string,
  values: Partial<NewServiceRequestRecord>
) => {
  const [row] = await db.update(serviceRequest).set(values).where(eq(serviceRequest.id, id)).returning()
  return row
}

export const deleteServiceRequest = (id: string) =>
  db.delete(serviceRequest).where(eq(serviceRequest.id, id))
