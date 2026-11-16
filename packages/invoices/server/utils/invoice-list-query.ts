import { sql } from 'drizzle-orm'
import type { InvoiceListQuery } from './invoice-validation'

// Build both queries from the same scoped relation. No invoice snapshots, images,
// line descriptions or payment histories are read for a collection page.
export const invoiceListQueries = (organizationId: string, query: InvoiceListQuery, today: string) => {
  const filters = [sql`i.organization_id = ${organizationId}`]
  if (query.status) {
    filters.push(sql`i.status = ${query.status}`)
  }
  if (query.clientOrganizationId) {
    filters.push(sql`i.client_organization_id = ${query.clientOrganizationId}`)
  }
  if (query.search) {
    const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`
    filters.push(sql`(i.number ilike ${pattern} or i.recipient_name ilike ${pattern} or i.subject ilike ${pattern})`)
  }
  const scoped = sql`
    with candidates as (
      select i.id, i.number, i.status, i.currency, i.issue_date, i.due_date, i.subject,
        i.recipient_name, i.client_organization_id
      from invoices.invoice i where ${sql.join(filters, sql` and `)}
    ), line_amounts as (
      select l.invoice_id,
        round(l.quantity_milli::numeric * l.unit_price_minor / 1000) as amount,
        l.exact_tax_minor, l.vat_rate_basis_points
      from invoices.invoice_line l inner join candidates c on c.id = l.invoice_id
    ), totals as (
      select invoice_id, sum(amount + coalesce(exact_tax_minor,
        floor(amount * vat_rate_basis_points / 10000 + 0.5))) as total
      from line_amounts group by invoice_id
    ), payments as (
      select p.invoice_id, sum(p.amount_minor) as paid from invoices.invoice_payment p
      inner join candidates c on c.id = p.invoice_id group by p.invoice_id
    ), amounts as (
      select c.*, coalesce(t.total, 0)::float8 as "totalMinor",
        greatest(0, coalesce(t.total, 0) - coalesce(p.paid, 0))::float8 as "outstandingMinor"
      from candidates c left join totals t on t.invoice_id = c.id left join payments p on p.invoice_id = c.id
    ), summaries as (
      select a.*, (status = 'ISSUED' and "outstandingMinor" > 0 and due_date < ${today}::date) as "isOverdue",
        case when status = 'ISSUED' and "outstandingMinor" > 0
          then greatest(0, ${today}::date - due_date) else 0 end as "daysOverdue"
      from amounts a
    ), filtered as (
      select * from summaries ${query.overdue === undefined ? sql`` : sql`where "isOverdue" = ${query.overdue}`}
    )`
  const order =
    query.sortBy === 'number'
      ? sql`(select array_agg(case when part[1] ~ '^[0-9]+$' then lpad(part[1], 60, '0') else lower(part[1]) end)
        from regexp_matches(number, '([0-9]+|[^0-9]+)', 'g') as part)`
      : query.sortBy === 'totalMinor'
        ? sql`"totalMinor"`
        : query.sortBy === 'dueDate'
          ? sql`due_date`
          : sql`issue_date`
  const direction = query.sortDir === 'asc' ? sql`asc` : sql`desc`
  return {
    count: sql`${scoped} select count(*)::integer as total from filtered`,
    page: (page: number) => sql`${scoped}
      select id, number, status, currency, issue_date::text as "issueDate", due_date::text as "dueDate", subject,
        recipient_name as "recipientName", client_organization_id as "clientOrganizationId",
        "totalMinor", "outstandingMinor", "isOverdue", "daysOverdue",
        (select count(*)::integer from invoices.invoice_email_delivery e where e.invoice_id = f.id
          and e.purpose = 'REMINDER' and e.status = 'SENT') as "reminderCount",
        (select max(e.sent_at) from invoices.invoice_email_delivery e where e.invoice_id = f.id
          and e.purpose = 'REMINDER' and e.status = 'SENT') as "lastReminderSentAt"
      from filtered f order by ${order} ${direction}, id asc limit ${query.pageSize} offset ${(page - 1) * query.pageSize}`
  }
}
