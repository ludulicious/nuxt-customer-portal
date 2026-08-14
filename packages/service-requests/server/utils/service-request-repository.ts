import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { serviceRequest, type NewServiceRequestRecord, type ServiceRequestRecord } from '@nuxt-customer-portal/service-requests/server/db/schema/service-requests'
import { organization } from '@nuxt-customer-portal/core/schema'
import { alias } from 'drizzle-orm/pg-core'
import type { ServiceRequestDashboardDto, ServiceRequestDto, ServiceRequestListResponse } from '@nuxt-customer-portal/service-requests/shared/types/service-request'
import type { ServiceRequestQuery } from './service-request-validation'

const clientOrganization = alias(organization, 'service_request_client_organization')

export const toServiceRequestDto = (row: ServiceRequestRecord, clientName?: string): ServiceRequestDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  category: row.category,
  organizationId: row.organizationId,
  clientOrganizationId: row.clientOrganizationId,
  ...(clientName ? { clientName } : {}),
  createdById: row.createdById,
  assignedToId: row.assignedToId,
  attachments: row.attachments ?? [],
  internalNotes: row.internalNotes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  closedAt: row.closedAt?.toISOString() ?? null
})

const filterConditions = (organizationId: string, filters: ServiceRequestQuery, scope?: { clientOrganizationId?: string, createdById?: string }): SQL[] => {
  const conditions: SQL[] = [eq(serviceRequest.organizationId, organizationId)]
  if (scope?.clientOrganizationId) conditions.push(eq(serviceRequest.clientOrganizationId, scope.clientOrganizationId))
  if (scope?.createdById) conditions.push(eq(serviceRequest.createdById, scope.createdById))
  if (filters.clientOrganizationId) conditions.push(eq(serviceRequest.clientOrganizationId, filters.clientOrganizationId))
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
  filters: ServiceRequestQuery,
  scope?: { clientOrganizationId?: string, createdById?: string }
): Promise<ServiceRequestListResponse> => {
  const where = and(...filterConditions(organizationId, filters, scope))
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
    db.select({ request: serviceRequest, clientName: clientOrganization.name })
      .from(serviceRequest)
      .innerJoin(clientOrganization, eq(clientOrganization.id, serviceRequest.clientOrganizationId))
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
    items: rows.map(row => toServiceRequestDto(row.request, row.clientName)),
    pagination: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: Math.ceil(total / filters.pageSize)
    }
  }
}

export const getServiceRequestDashboard = async (organizationId: string, canManage: boolean, scope?: { clientOrganizationId?: string, createdById?: string }): Promise<ServiceRequestDashboardDto> => {
  const rows = await db.select({ request: serviceRequest, clientName: clientOrganization.name }).from(serviceRequest)
    .innerJoin(clientOrganization, eq(clientOrganization.id, serviceRequest.clientOrganizationId))
    .where(and(...filterConditions(organizationId, { page: 1, pageSize: 20, offset: 0, sortBy: 'createdAt', sortDir: 'desc' }, scope)))
    .orderBy(desc(serviceRequest.updatedAt), asc(serviceRequest.id))
  const records = rows.map(row => row.request)
  const names = new Map(rows.map(row => [row.request.id, row.clientName]))
  const active = records.filter(item => item.status === 'OPEN' || item.status === 'IN_PROGRESS')
  const longOpenBoundary = Date.now() - 7 * 24 * 60 * 60 * 1000
  const priorityRank = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const
  const attentionItems = [...active].sort((left, right) =>
    priorityRank[right.priority] - priorityRank[left.priority]
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id))
  return {
    overview: {
      activeCount: active.length,
      resolvedCount: records.length - active.length,
      recent: records.slice(0, 5).map(item => toServiceRequestDto(item, names.get(item.id)))
    },
    ...(canManage && { attention: {
      urgentCount: active.filter(item => item.priority === 'URGENT').length,
      unassignedCount: active.filter(item => !item.assignedToId).length,
      longOpenCount: active.filter(item => item.createdAt.getTime() < longOpenBoundary).length,
      items: attentionItems.slice(0, 5).map(item => toServiceRequestDto(item, names.get(item.id)))
    } })
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
