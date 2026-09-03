import type {
  ActivityTypeDto,
  ClientApprovalItemDto,
  ClientDto,
  ClientSupplierTimesheetItemDto,
  ProjectDto,
  TimesheetsListResponse
} from '@nuxt-customer-portal/timesheets/shared/types/timesheet'
import type {
  ActivityListQuery,
  InternalApprovalListQuery,
  ClientApprovalListQuery,
  ClientListQuery,
  ClientSupplierTimesheetListQuery,
  ProjectListQuery
} from './timesheet-validation'
import {
  listActivities,
  listApprovalQueue,
  listClientApprovals,
  listClientSupplierTimesheets,
  listClients,
  listProjects
} from './timesheet-repository'

const compareText = (left: string | null | undefined, right: string | null | undefined) =>
  (left ?? '').localeCompare(right ?? '', undefined, { sensitivity: 'base', numeric: true })
const direction = (value: number, sortDir: 'asc' | 'desc') => (sortDir === 'asc' ? value : -value)
const includes = (value: string | null | undefined, search: string) =>
  (value ?? '').toLocaleLowerCase().includes(search)
const paginate = <T>(items: T[], page: number, pageSize: number): TimesheetsListResponse<T> => {
  const total = items.length
  const pageCount = Math.ceil(total / pageSize)
  const safePage = pageCount ? Math.min(page, pageCount) : 1
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    pagination: { total, page: safePage, pageSize, pageCount }
  }
}

export const listInternalApprovalsPage = async (
  organizationId: string,
  actorUserId: string,
  query: InternalApprovalListQuery
) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listApprovalQueue(organizationId, actorUserId))
    .filter((item) => !search || includes(item.userName, search))
    .filter((item) => !query.status || item.status === query.status)
    .sort(
      (a, b) =>
        direction(
          query.sortBy === 'totalMinutes'
            ? a.totalMinutes - b.totalMinutes
            : compareText(a[query.sortBy], b[query.sortBy]),
          query.sortDir
        ) || compareText(a.id, b.id)
    )
  return paginate(rows, query.page, query.pageSize)
}

export const listProjectsPage = async (organizationId: string, query: ProjectListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listProjects(organizationId))
    .filter((item) => !search || [item.name, item.code, item.clientName].some((value) => includes(value, search)))
    .filter((item) => !query.clientOrganizationId || item.clientOrganizationId === query.clientOrganizationId)
    .filter((item) => !query.status || query.status === 'ALL' || item.status === query.status)
    .sort(
      (a, b) =>
        direction(
          query.sortBy === 'clientName'
            ? compareText(a.clientName, b.clientName)
            : query.sortBy === 'startsOn'
              ? compareText(a.startsOn, b.startsOn)
              : compareText(a.name, b.name),
          query.sortDir
        ) || compareText(a.id, b.id)
    )
  return paginate<ProjectDto>(rows, query.page, query.pageSize)
}

export const listClientsPage = async (organizationId: string, query: ClientListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const configured = (item: ClientDto) => item.accessMode !== 'DISABLED'
  const rows = (await listClients(organizationId))
    .filter((item) => !search || [item.name, item.officialName, item.slug].some((value) => includes(value, search)))
    .filter((item) => !query.configured || configured(item) === (query.configured === 'configured'))
    .sort((a, b) => direction(compareText(a.name, b.name), query.sortDir) || compareText(a.id, b.id))
  return paginate<ClientDto>(rows, query.page, query.pageSize)
}

export const listActivitiesPage = async (organizationId: string, query: ActivityListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listActivities(organizationId))
    .filter((item) => !search || includes(item.name, search))
    .filter((item) => query.active === undefined || item.active === (query.active === 'true'))
    .filter((item) => query.billable === undefined || item.billable === (query.billable === 'true'))
    .sort(
      (a, b) =>
        direction(
          query.sortBy === 'active'
            ? Number(a.active) - Number(b.active)
            : query.sortBy === 'billable'
              ? Number(a.billable) - Number(b.billable)
              : compareText(a.name, b.name),
          query.sortDir
        ) || compareText(a.id, b.id)
    )
  return paginate<ActivityTypeDto>(rows, query.page, query.pageSize)
}

export const listClientApprovalsPage = async (
  clientOrganizationId: string,
  actorUserId: string,
  isAdmin: boolean,
  query: ClientApprovalListQuery
) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listClientApprovals(clientOrganizationId, actorUserId, isAdmin)).items
    .filter(
      (item) =>
        !search ||
        [
          item.supplierName,
          item.person,
          item.reviewerName,
          item.comment,
          ...item.entries.flatMap((entry) => [entry.project, entry.activity, entry.note])
        ].some((value) => includes(value, search))
    )
    .filter((item) => !query.workspaceClientId || item.workspaceClientId === query.workspaceClientId)
    .filter((item) => !query.status || item.status === query.status)
    .sort(
      (a, b) =>
        direction(
          query.sortBy === 'supplierName'
            ? compareText(a.supplierName, b.supplierName)
            : query.sortBy === 'person'
              ? compareText(a.person, b.person)
              : query.sortBy === 'status'
                ? compareText(a.status, b.status)
                : query.sortBy === 'totalMinutes'
                  ? a.totalMinutes - b.totalMinutes
                  : compareText(a.weekStartsOn, b.weekStartsOn),
          query.sortDir
        ) || compareText(a.id, b.id)
    )
  return paginate<ClientApprovalItemDto>(rows, query.page, query.pageSize)
}

export const listClientSupplierTimesheetsPage = async (
  clientOrganizationId: string,
  actorUserId: string,
  isAdmin: boolean,
  query: ClientSupplierTimesheetListQuery
) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listClientSupplierTimesheets(clientOrganizationId, actorUserId, isAdmin))
    .filter(
      (item) =>
        !search ||
        [
          item.supplierName,
          item.person,
          ...item.entries.flatMap((entry) => [entry.project, entry.activity, entry.note])
        ].some((value) => includes(value, search))
    )
    .filter((item) => !query.workspaceClientId || item.workspaceClientId === query.workspaceClientId)
    .sort(
      (a, b) =>
        direction(
          query.sortBy === 'supplierName'
            ? compareText(a.supplierName, b.supplierName)
            : query.sortBy === 'person'
              ? compareText(a.person, b.person)
              : query.sortBy === 'totalMinutes'
                ? a.totalMinutes - b.totalMinutes
                : compareText(a.weekStartsOn, b.weekStartsOn),
          query.sortDir
        ) || compareText(a.id, b.id)
    )
  return paginate<ClientSupplierTimesheetItemDto>(rows, query.page, query.pageSize)
}
