import type { ActivityTypeDto, ClientDto, InvoiceDto, ProjectDto, TimesheetsListResponse } from '#layers/timesheets/shared/types/timesheet'
import type { ActivityListQuery, ClientListQuery, InvoiceListQuery, ProjectListQuery } from './timesheet-validation'
import { listActivities, listClients, listInvoices, listProjects } from './timesheet-repository'

const compareText = (left: string | null | undefined, right: string | null | undefined) => (left ?? '').localeCompare(right ?? '', undefined, { sensitivity: 'base', numeric: true })
const direction = (value: number, sortDir: 'asc' | 'desc') => sortDir === 'asc' ? value : -value
const includes = (value: string | null | undefined, search: string) => (value ?? '').toLocaleLowerCase().includes(search)
const paginate = <T>(items: T[], page: number, pageSize: number): TimesheetsListResponse<T> => {
  const total = items.length
  const pageCount = Math.ceil(total / pageSize)
  const safePage = pageCount ? Math.min(page, pageCount) : 1
  return { items: items.slice((safePage - 1) * pageSize, safePage * pageSize), pagination: { total, page: safePage, pageSize, pageCount } }
}

export const listProjectsPage = async (organizationId: string, query: ProjectListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listProjects(organizationId)).filter(item => item.status === 'ACTIVE')
    .filter(item => !search || [item.name, item.code, item.clientName].some(value => includes(value, search)))
    .filter(item => !query.clientOrganizationId || item.clientOrganizationId === query.clientOrganizationId)
    .sort((a, b) => direction(query.sortBy === 'clientName' ? compareText(a.clientName, b.clientName) : query.sortBy === 'startsOn' ? compareText(a.startsOn, b.startsOn) : compareText(a.name, b.name), query.sortDir) || compareText(a.id, b.id))
  return paginate<ProjectDto>(rows, query.page, query.pageSize)
}

export const listClientsPage = async (organizationId: string, query: ClientListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const configured = (item: ClientDto) => Boolean(item.address.trim() && item.invoiceEmail)
  const rows = (await listClients(organizationId))
    .filter(item => !search || [item.name, item.officialName, item.address, item.invoiceEmail, ...item.contacts.flatMap(contact => [contact.name, contact.email])].some(value => includes(value, search)))
    .filter(item => !query.configured || configured(item) === (query.configured === 'configured'))
    .sort((a, b) => direction(compareText(a.name, b.name), query.sortDir) || compareText(a.id, b.id))
  return paginate<ClientDto>(rows, query.page, query.pageSize)
}

export const listActivitiesPage = async (organizationId: string, query: ActivityListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listActivities(organizationId))
    .filter(item => !search || includes(item.name, search))
    .filter(item => query.active === undefined || item.active === (query.active === 'true'))
    .filter(item => query.billable === undefined || item.billable === (query.billable === 'true'))
    .sort((a, b) => direction(query.sortBy === 'active' ? Number(a.active) - Number(b.active) : query.sortBy === 'billable' ? Number(a.billable) - Number(b.billable) : compareText(a.name, b.name), query.sortDir) || compareText(a.id, b.id))
  return paginate<ActivityTypeDto>(rows, query.page, query.pageSize)
}

export const listInvoicesPage = async (organizationId: string, query: InvoiceListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listInvoices(organizationId))
    .filter(item => !search || [item.number, item.recipientName, item.subject].some(value => includes(value, search)))
    .filter(item => !query.status || item.status === query.status)
    .filter(item => !query.clientOrganizationId || item.clientOrganizationId === query.clientOrganizationId)
    .filter(item => query.overdue === undefined || item.isOverdue === (query.overdue === 'true'))
    .sort((a, b) => direction(query.sortBy === 'number' ? compareText(a.number, b.number) : query.sortBy === 'dueDate' ? compareText(a.dueDate, b.dueDate) : query.sortBy === 'totalMinor' ? a.totalMinor - b.totalMinor : compareText(a.issueDate, b.issueDate), query.sortDir) || compareText(a.id, b.id))
  return paginate<InvoiceDto>(rows, query.page, query.pageSize)
}
