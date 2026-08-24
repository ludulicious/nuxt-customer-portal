import { and, eq, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { invoice, invoiceLine } from '@nuxt-customer-portal/invoices/schema'
import {
  createInvoiceInTransaction,
  requireInvoicesEnabled
} from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { timeEntry, timesheetClientReview, weeklyTimesheet } from '@nuxt-customer-portal/timesheets/schema'
import {
  getReport,
  requireTimesheetWorkspace
} from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { invoiceTimeEntry } from '@nuxt-customer-portal/invoice-timesheets/server/db/schema/invoice-timesheets'

export const listTimesheetInvoiceSources = async (organizationId: string, from?: string, to?: string) => {
  try {
    await requireTimesheetWorkspace(organizationId)
  } catch {
    return { enabled: false, entries: [] }
  }
  const report = await getReport(organizationId, { status: 'APPROVED', billable: true, from, to })
  if (!report.rows.length) {
    return { enabled: true, entries: [] }
  }
  const ids = report.rows.map((row) => row.entryId)
  const [contexts, linked, disputed] = await Promise.all([
    db
      .select({
        entryId: timeEntry.id,
        weeklyTimesheetId: timeEntry.weeklyTimesheetId,
        clientOrganizationId: timeEntry.clientOrganizationId,
        projectId: timeEntry.projectId
      })
      .from(timeEntry)
      .where(and(eq(timeEntry.organizationId, organizationId), inArray(timeEntry.id, ids))),
    db
      .select({ timeEntryId: invoiceTimeEntry.timeEntryId })
      .from(invoiceTimeEntry)
      .innerJoin(invoice, eq(invoice.id, invoiceTimeEntry.invoiceId))
      .where(and(inArray(invoiceTimeEntry.timeEntryId, ids), inArray(invoice.status, ['DRAFT', 'ISSUED', 'PAID']))),
    db
      .select({
        weeklyTimesheetId: timesheetClientReview.weeklyTimesheetId,
        clientOrganizationId: timesheetClientReview.clientOrganizationId
      })
      .from(timesheetClientReview)
      .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetClientReview.weeklyTimesheetId))
      .where(and(eq(weeklyTimesheet.organizationId, organizationId), eq(timesheetClientReview.status, 'DISPUTED')))
  ])
  const context = new Map(contexts.map((item) => [item.entryId, item]))
  const used = new Set(linked.map((item) => item.timeEntryId))
  const disputes = new Set(disputed.map((item) => `${item.weeklyTimesheetId}:${item.clientOrganizationId}`))
  return {
    enabled: true,
    entries: report.rows.flatMap((row) => {
      const item = context.get(row.entryId)
      return !item || used.has(row.entryId) || disputes.has(`${item.weeklyTimesheetId}:${item.clientOrganizationId}`)
        ? []
        : [
            {
              entryId: row.entryId,
              date: row.date,
              client: row.client,
              clientOrganizationId: item.clientOrganizationId,
              project: row.project,
              projectId: item.projectId,
              person: row.person,
              activity: row.activity,
              minutes: row.minutes,
              hourlyRateMinor: row.hourlyRateMinor,
              amountMinor: row.amountMinor,
              currency: row.currency,
              note: row.note
            }
          ]
    })
  }
}

export const createInvoiceFromTimesheets = async (
  organizationId: string,
  actorUserId: string,
  input: {
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
      timeEntryIds: string[]
    }>
  }
) => {
  await requireTimesheetWorkspace(organizationId)
  await requireInvoicesEnabled(organizationId)
  return db.transaction(async (tx) => {
    const sourceIds = input.lines.flatMap((line) => line.timeEntryIds)
    if (new Set(sourceIds).size !== sourceIds.length) {
      throw createError({ statusCode: 400, message: 'A time entry can only occur once on an invoice' })
    }
    for (const sourceId of [...sourceIds].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`invoice-timesheet:${sourceId}`}))`)
    }
    const [entries, existing, disputed] = await Promise.all([
      tx
        .select({ entry: timeEntry, status: weeklyTimesheet.status })
        .from(timeEntry)
        .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timeEntry.weeklyTimesheetId))
        .where(
          and(
            eq(timeEntry.organizationId, organizationId),
            eq(timeEntry.clientOrganizationId, input.clientOrganizationId),
            inArray(timeEntry.id, sourceIds)
          )
        ),
      tx
        .select({ id: invoiceTimeEntry.id })
        .from(invoiceTimeEntry)
        .innerJoin(invoice, eq(invoice.id, invoiceTimeEntry.invoiceId))
        .where(
          and(inArray(invoiceTimeEntry.timeEntryId, sourceIds), inArray(invoice.status, ['DRAFT', 'ISSUED', 'PAID']))
        ),
      tx
        .select({ weeklyTimesheetId: timesheetClientReview.weeklyTimesheetId })
        .from(timesheetClientReview)
        .innerJoin(weeklyTimesheet, eq(weeklyTimesheet.id, timesheetClientReview.weeklyTimesheetId))
        .where(
          and(
            eq(weeklyTimesheet.organizationId, organizationId),
            eq(timesheetClientReview.clientOrganizationId, input.clientOrganizationId),
            eq(timesheetClientReview.status, 'DISPUTED')
          )
        )
    ])
    const disputedWeeks = new Set(disputed.map((item) => item.weeklyTimesheetId))
    if (
      entries.length !== sourceIds.length ||
      existing.length ||
      entries.some(
        (row) =>
          row.status !== 'APPROVED' ||
          disputedWeeks.has(row.entry.weeklyTimesheetId) ||
          !row.entry.billableSnapshot ||
          row.entry.currencySnapshot !== input.currency
      )
    ) {
      throw createError({ statusCode: 409, message: 'One or more time entries are unavailable for invoicing' })
    }
    const byId = new Map(entries.map((row) => [row.entry.id, row.entry]))
    for (const line of input.lines) {
      const sources = line.timeEntryIds.map((id) => byId.get(id)!)
      if (
        new Set(sources.map((entry) => entry.hourlyRateMinorSnapshot)).size !== 1 ||
        line.unitPriceMinor !== sources[0]!.hourlyRateMinorSnapshot ||
        line.quantityMilli !== Math.round((sources.reduce((sum, entry) => sum + entry.durationMinutes, 0) * 1000) / 60)
      ) {
        throw createError({
          statusCode: 400,
          message: 'Timesheet invoice line totals do not match their source entries'
        })
      }
    }
    const created = await createInvoiceInTransaction(tx, organizationId, actorUserId, {
      ...input,
      lines: input.lines.map(({ timeEntryIds: _ids, ...line }) => line)
    })
    const createdLines = await tx.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, created.id))
    for (const [position, source] of input.lines.entries()) {
      const line = createdLines.find((item) => item.position === position)!
      await tx.insert(invoiceTimeEntry).values(
        source.timeEntryIds.map((timeEntryId) => ({
          id: nanoid(),
          invoiceId: created.id,
          invoiceLineId: line.id,
          timeEntryId
        }))
      )
    }
    return created
  })
}

export const hasActiveInvoiceSource = async (organizationId: string, entryIds: string[]) => {
  if (!entryIds.length) {
    return false
  }
  const [selected] = await db
    .select({ id: invoiceTimeEntry.id })
    .from(invoiceTimeEntry)
    .innerJoin(invoice, eq(invoice.id, invoiceTimeEntry.invoiceId))
    .where(
      and(
        eq(invoice.organizationId, organizationId),
        inArray(invoiceTimeEntry.timeEntryId, entryIds),
        inArray(invoice.status, ['DRAFT', 'ISSUED', 'PAID'])
      )
    )
    .limit(1)
  return Boolean(selected)
}
