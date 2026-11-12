import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { getClient } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { billingContact, invoice, invoiceSettings, recurringInvoice } from '../db/schema/invoices'
import { createInvoiceInTransaction, requireInvoicesEnabled } from './invoice-repository'
import { invoiceCreateSchema } from './invoice-validation'
import { firstInvoiceNumber, hasNumericInvoiceSequence, incrementInvoiceNumber } from '../../shared/invoice-number'
import {
  addCalendarDays,
  nextRecurrenceDate,
  renderPeriodText,
  recurringInvoiceSchema,
  type RecurringInvoiceDto,
  type RecurringInvoiceInput
} from '../../shared/recurring-invoice'

const dto = (row: typeof recurringInvoice.$inferSelect): RecurringInvoiceDto => ({
  ...row.template,
  id: row.id,
  name: row.name,
  enabled: row.enabled,
  nextDate: row.nextDate,
  lastGeneratedDate: row.lastGeneratedDate,
  lastError: row.lastError
})
export const recurringListQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  enabled: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['name', 'nextDate']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(20).default(20)
})
export const listRecurringInvoices = async (
  organizationId: string,
  query: z.infer<typeof recurringListQuerySchema>
) => {
  const where = and(
    eq(recurringInvoice.organizationId, organizationId),
    query.search ? ilike(recurringInvoice.name, `%${query.search}%`) : undefined,
    query.enabled ? eq(recurringInvoice.enabled, query.enabled === 'true') : undefined
  )
  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(recurringInvoice)
    .where(where)
  const total = count!.total
  const pageCount = Math.ceil(total / query.pageSize)
  const page = Math.min(query.page, pageCount || 1)
  const order = query.sortDir === 'asc' ? asc : desc
  const items = await db
    .select()
    .from(recurringInvoice)
    .where(where)
    .orderBy(order(recurringInvoice[query.sortBy]), asc(recurringInvoice.id))
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize)
  return { items: items.map(dto), pagination: { total, page, pageCount, pageSize: query.pageSize } }
}

export const saveRecurringInvoice = async (
  organizationId: string,
  actorUserId: string,
  value: unknown,
  id?: string
) => {
  await requireInvoicesEnabled(organizationId)
  const input = recurringInvoiceSchema.parse(value)
  return db.transaction(async (tx) => {
    const [existing] = id
      ? await tx
          .select()
          .from(recurringInvoice)
          .where(and(eq(recurringInvoice.id, id), eq(recurringInvoice.organizationId, organizationId)))
          .for('update')
      : []
    if (id && !existing) {
      throw createError({ statusCode: 404, message: 'Recurring invoice not found' })
    }
    const unchangedClient = existing?.template.clientOrganizationId === input.clientOrganizationId
    const client = await getClient(input.clientOrganizationId)
    if ((!client || client.archivedAt) && !unchangedClient) {
      throw createError({ statusCode: 400, message: 'Client is unavailable' })
    }
    if (input.contactId) {
      const [contact] = await tx
        .select()
        .from(billingContact)
        .where(
          and(eq(billingContact.id, input.contactId), eq(billingContact.organizationId, input.clientOrganizationId))
        )
        .limit(1)
      const unchangedContact = unchangedClient && existing?.template.contactId === input.contactId
      if ((client?.clientType === 'person' || !contact) && !unchangedContact) {
        throw createError({ statusCode: 400, message: 'Contact does not belong to this client' })
      }
    }
    if (
      existing?.lastGeneratedDate &&
      (input.startDate !== existing.template.startDate ||
        input.period !== existing.template.period ||
        input.timeZone !== existing.template.timeZone)
    ) {
      throw createError({
        statusCode: 409,
        message:
          'Start date, period and timezone cannot change after draft generation; pause this schedule and create a new one'
      })
    }
    let nextDate: string | null = existing?.lastGeneratedDate
      ? nextRecurrenceDate(input.startDate, input.period, existing.lastGeneratedDate)
      : input.startDate
    if (input.endDate && nextDate > input.endDate) {
      nextDate = null
    }
    const values = {
      name: input.name,
      enabled: input.enabled,
      template: input,
      nextDate,
      lastError: null,
      updatedAt: new Date()
    }
    const [saved] = existing
      ? await tx.update(recurringInvoice).set(values).where(eq(recurringInvoice.id, existing.id)).returning()
      : await tx
          .insert(recurringInvoice)
          .values({ ...values, id: nanoid(), organizationId, createdById: actorUserId })
          .returning()
    return dto(saved!)
  })
}

export const recurringDraftInput = (template: RecurringInvoiceInput, date: string, number: string) =>
  invoiceCreateSchema.parse({
    clientOrganizationId: template.clientOrganizationId,
    contactId: template.contactId,
    currency: template.currency,
    number,
    issueDate: date,
    dueDate: addCalendarDays(date, template.paymentTermDays),
    subject: renderPeriodText(template.subject, template, date),
    notes: renderPeriodText(template.notes, template, date),
    lines: template.lines.map((line) => ({ ...line, description: renderPeriodText(line.description, template, date) }))
  })

export const generateRecurringInvoices = async (now = new Date()) => {
  const due = sql`${recurringInvoice.nextDate} <= (${now.toISOString()}::timestamptz AT TIME ZONE (${recurringInvoice.template}->>'timeZone'))::date`
  const candidates = await db
    .select({ id: recurringInvoice.id })
    .from(recurringInvoice)
    .innerJoin(
      invoiceSettings,
      and(eq(invoiceSettings.organizationId, recurringInvoice.organizationId), eq(invoiceSettings.enabled, true))
    )
    .where(and(eq(recurringInvoice.enabled, true), due))
    .orderBy(
      sql`${recurringInvoice.lastAttemptAt} ASC NULLS FIRST`,
      asc(recurringInvoice.nextDate),
      asc(recurringInvoice.id)
    )
    .limit(50)
  let created = 0
  let failed = 0
  for (const candidate of candidates) {
    while (true) {
      let attemptedDate: string | null = null
      try {
        const generated = await db.transaction(async (tx) => {
          const [schedule] = await tx
            .select()
            .from(recurringInvoice)
            .where(and(eq(recurringInvoice.id, candidate.id), eq(recurringInvoice.enabled, true), due))
            .for('update', { skipLocked: true })
          if (!schedule?.nextDate) {
            return false
          }
          const [settings] = await tx
            .select()
            .from(invoiceSettings)
            .where(and(eq(invoiceSettings.organizationId, schedule.organizationId), eq(invoiceSettings.enabled, true)))
            .for('update')
          if (!settings) {
            return false
          }
          const template = recurringInvoiceSchema.parse(schedule.template)
          const date = schedule.nextDate
          attemptedDate = date
          if (template.endDate && date > template.endDate) {
            await tx.update(recurringInvoice).set({ nextDate: null }).where(eq(recurringInvoice.id, schedule.id))
            return false
          }
          const existing = await tx
            .select({ number: invoice.number })
            .from(invoice)
            .where(eq(invoice.organizationId, schedule.organizationId))
            .orderBy(desc(invoice.createdAt), desc(invoice.id))
          const used = new Set(existing.map((item) => item.number))
          const latest = existing.find((item) => hasNumericInvoiceSequence(item.number))
          let number = latest ? incrementInvoiceNumber(latest.number) : firstInvoiceNumber(Number(date.slice(0, 4)))
          while (used.has(number)) {
            number = incrementInvoiceNumber(number)
          }
          const draft = await createInvoiceInTransaction(
            tx,
            schedule.organizationId,
            schedule.createdById,
            recurringDraftInput(template, date, number)
          )
          await tx
            .update(invoice)
            .set({ recurringInvoiceId: schedule.id, scheduledDate: date })
            .where(eq(invoice.id, draft.id))
          const next = nextRecurrenceDate(template.startDate, template.period, date)
          await tx
            .update(recurringInvoice)
            .set({
              lastGeneratedDate: date,
              nextDate: template.endDate && next > template.endDate ? null : next,
              lastAttemptAt: now,
              lastError: null
            })
            .where(eq(recurringInvoice.id, schedule.id))
          return true
        })
        if (!generated) {
          break
        }
        created++
      } catch {
        failed++
        await db
          .update(recurringInvoice)
          .set({
            lastAttemptAt: now,
            lastError:
              'Draft generation failed. Check invoice settings, client details and template values. The scheduler will retry automatically.'
          })
          .where(
            and(
              eq(recurringInvoice.id, candidate.id),
              attemptedDate ? eq(recurringInvoice.nextDate, attemptedDate) : undefined
            )
          )
        break
      }
    }
  }
  return { created, failed }
}
