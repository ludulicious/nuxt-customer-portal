import type { ClientInvoiceSummaryDto, InvoiceDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import type { ClientInvoiceListQuery, InvoiceListQuery } from './invoice-validation'
import { listClientInvoices, listInvoices } from './invoice-repository'

const compare = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true })
const direction = (value: number, dir: 'asc' | 'desc') => (dir === 'asc' ? value : -value)
const paginate = <T>(items: T[], page: number, pageSize: number) => {
  const total = items.length
  const pageCount = Math.ceil(total / pageSize)
  const safePage = pageCount ? Math.min(page, pageCount) : 1
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    pagination: { total, page: safePage, pageSize, pageCount }
  }
}
const includes = (value: string | null | undefined, search: string) =>
  (value ?? '').toLocaleLowerCase().includes(search)
export const listInvoicesPage = async (organizationId: string, query: InvoiceListQuery) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listInvoices(organizationId))
    .filter(
      (item) => !search || [item.number, item.recipientName, item.subject].some((value) => includes(value, search))
    )
    .filter((item) => !query.status || item.status === query.status)
    .filter((item) => !query.clientOrganizationId || item.clientOrganizationId === query.clientOrganizationId)
    .filter((item) => query.overdue === undefined || item.isOverdue === query.overdue)
    .sort(
      (a, b) =>
        direction(
          query.sortBy === 'number'
            ? compare(a.number, b.number)
            : query.sortBy === 'dueDate'
              ? compare(a.dueDate, b.dueDate)
              : query.sortBy === 'totalMinor'
                ? a.totalMinor - b.totalMinor
                : compare(a.issueDate, b.issueDate),
          query.sortDir
        ) || compare(a.id, b.id)
    )
  return paginate<InvoiceDto>(rows, query.page, query.pageSize)
}
export const listClientInvoicesPage = async (
  organizationId: string,
  userId: string,
  isAdmin: boolean,
  query: ClientInvoiceListQuery
) => {
  const search = query.search?.toLocaleLowerCase() ?? ''
  const rows = (await listClientInvoices(organizationId, userId, isAdmin))
    .filter(
      (item) => !search || [item.number, item.supplierName, item.subject].some((value) => includes(value, search))
    )
    .filter((item) => !query.status || item.status === query.status)
    .filter((item) => !query.accessId || item.accessId === query.accessId)
    .filter((item) => query.overdue === undefined || item.isOverdue === query.overdue)
    .sort(
      (a, b) =>
        direction(
          query.sortBy === 'number'
            ? compare(a.number, b.number)
            : query.sortBy === 'dueDate'
              ? compare(a.dueDate, b.dueDate)
              : query.sortBy === 'totalMinor'
                ? a.totalMinor - b.totalMinor
                : compare(a.issueDate, b.issueDate),
          query.sortDir
        ) || compare(a.id, b.id)
    )
  return paginate<ClientInvoiceSummaryDto>(rows, query.page, query.pageSize)
}
