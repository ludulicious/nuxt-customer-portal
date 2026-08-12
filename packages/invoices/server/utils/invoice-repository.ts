import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, getPortalOrganizationsByIds, listPortalOrganizationMembers } from '@nuxt-customer-portal/core/server/portal'
import { organization, user } from '@nuxt-customer-portal/core/schema'
import { clientModule } from '@nuxt-customer-portal/clients/server/db/schema/clients'
import { getClient, listSelectableClients } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { firstInvoiceNumber, hasNumericInvoiceSequence, incrementInvoiceNumber } from '@nuxt-customer-portal/invoices/shared/invoice-number'
import type { InvoiceCreateInput } from './invoice-validation'
import type { InvoiceDto, InvoiceSettingsDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import { billingContact, invoice, invoiceAttachment, invoiceClientAccess, invoiceClientViewer, invoiceEmailDelivery, invoiceHistory, invoiceLine, invoicePayment, invoiceSettings } from '@nuxt-customer-portal/invoices/server/db/schema/invoices'

const overdue = (dueDate: string, status: string, outstandingMinor: number) => {
  if (!['ISSUED'].includes(status) || outstandingMinor <= 0) return { isOverdue: false, daysOverdue: 0 }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00Z`)
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000))
  return { isOverdue: daysOverdue > 0, daysOverdue }
}

export const ensureInvoiceSettings = async (organizationId: string) => {
  const [settings] = await db.insert(invoiceSettings).values({ organizationId }).onConflictDoNothing().returning()
  if (settings) return settings
  return (await db.select().from(invoiceSettings).where(eq(invoiceSettings.organizationId, organizationId)).limit(1))[0]!
}

export const requireInvoicesEnabled = async (organizationId: string) => {
  const settings = await ensureInvoiceSettings(organizationId)
  if (!settings.enabled) throw createError({ statusCode: 403, message: 'Invoices are not enabled for this organization' })
  return settings
}

export const getInvoiceSettings = async (organizationId: string): Promise<InvoiceSettingsDto> => {
  const row = await ensureInvoiceSettings(organizationId)
  return { ...row, preferredLocale: row.preferredLocale === 'en' ? 'en' : 'nl' }
}

export const updateInvoiceSettings = async (organizationId: string, input: Omit<InvoiceSettingsDto, 'organizationId'>) => {
  const [updated] = await db.insert(invoiceSettings).values({ organizationId, ...input }).onConflictDoUpdate({ target: invoiceSettings.organizationId, set: { ...input, updatedAt: new Date() } }).returning()
  return updated!
}

export const getOrganizationInvoiceProfile = async (organizationId: string) => {
  const [settings, selected] = await Promise.all([getInvoiceSettings(organizationId), db.select().from(organization).where(eq(organization.id, organizationId)).limit(1)])
  return { ...settings, name: selected[0]?.name ?? '', logo: selected[0]?.logo ?? null }
}

export const listInvoiceClients = async (organizationId: string) => {
  const clients = await listSelectableClients()
  const ids = clients.map(item => item.organizationId)
  const contacts = ids.length ? await db.select().from(billingContact).where(inArray(billingContact.organizationId, ids)) : []
  return clients.map(client => ({ ...client, contacts: contacts.filter(contact => contact.organizationId === client.organizationId) }))
}

const requireInvoiceClient = async (clientOrganizationId: string) => {
  const client = await getClient(clientOrganizationId)
  if (!client || client.archivedAt) throw createError({ statusCode: 404, message: 'Client not found' })
  return client
}

export const listBillingContacts = async (clientOrganizationId: string) => {
  await requireInvoiceClient(clientOrganizationId)
  return db.select().from(billingContact).where(eq(billingContact.organizationId, clientOrganizationId)).orderBy(asc(billingContact.name))
}

export const createBillingContact = async (clientOrganizationId: string, input: { userId?: string | null, name: string, email: string, phone?: string | null, jobTitle?: string | null }) => {
  await requireInvoiceClient(clientOrganizationId)
  try {
    const [created] = await db.insert(billingContact).values({ id: nanoid(), organizationId: clientOrganizationId, ...input }).returning()
    return created!
  } catch (error) {
    if ((error as { code?: string, cause?: { code?: string } }).code === '23505' || (error as { cause?: { code?: string } }).cause?.code === '23505') throw createError({ statusCode: 409, message: 'A billing contact with this email already exists' })
    throw error
  }
}

export const updateBillingContact = async (clientOrganizationId: string, id: string, input: Record<string, unknown>) => {
  await requireInvoiceClient(clientOrganizationId)
  try {
    const [updated] = await db.update(billingContact).set({ ...input, updatedAt: new Date() }).where(and(eq(billingContact.id, id), eq(billingContact.organizationId, clientOrganizationId))).returning()
    if (!updated) throw createError({ statusCode: 404, message: 'Billing contact not found' })
    return updated
  } catch (error) {
    if ((error as { code?: string, cause?: { code?: string } }).code === '23505' || (error as { cause?: { code?: string } }).cause?.code === '23505') throw createError({ statusCode: 409, message: 'A billing contact with this email already exists' })
    throw error
  }
}

export const deleteBillingContact = async (clientOrganizationId: string, id: string) => {
  await requireInvoiceClient(clientOrganizationId)
  const [deleted] = await db.delete(billingContact).where(and(eq(billingContact.id, id), eq(billingContact.organizationId, clientOrganizationId))).returning()
  if (!deleted) throw createError({ statusCode: 404, message: 'Billing contact not found' })
  return { deleted: true }
}

export const ensureClientAccess = async (providerOrganizationId: string, clientOrganizationId: string) => {
  const [created] = await db.insert(invoiceClientAccess).values({ id: nanoid(), providerOrganizationId, clientOrganizationId }).onConflictDoUpdate({ target: [invoiceClientAccess.providerOrganizationId, invoiceClientAccess.clientOrganizationId], set: { enabled: true, updatedAt: new Date() } }).returning()
  return created!
}

const requireClientInvoicesModule = async (clientOrganizationId: string) => {
  const [enabled] = await db.select({ id: clientModule.id }).from(clientModule).where(and(
    eq(clientModule.organizationId, clientOrganizationId),
    eq(clientModule.moduleId, 'invoices'),
    eq(clientModule.enabled, true)
  )).limit(1)
  if (!enabled) throw createError({ statusCode: 403, message: 'Invoices are not enabled for this client organization' })
}

export const listClientInvoiceSuppliers = async (clientOrganizationId: string, userId: string, isAdmin: boolean) => {
  await requireClientInvoicesModule(clientOrganizationId)
  const accesses = await db.select().from(invoiceClientAccess).where(and(eq(invoiceClientAccess.clientOrganizationId, clientOrganizationId), eq(invoiceClientAccess.enabled, true)))
  const assignments = accesses.length && !isAdmin ? await db.select().from(invoiceClientViewer).where(and(inArray(invoiceClientViewer.accessId, accesses.map(item => item.id)), eq(invoiceClientViewer.userId, userId))) : []
  const allowed = accesses.filter(item => isAdmin || assignments.some(assignment => assignment.accessId === item.id))
  const providers = await getPortalOrganizationsByIds(allowed.map(item => item.providerOrganizationId))
  return allowed.map(item => ({ id: item.id, providerOrganizationId: item.providerOrganizationId, providerName: providers.find(provider => provider.id === item.providerOrganizationId)?.name ?? '', canViewInvoices: true }))
}

const requireClientAccess = async (clientOrganizationId: string, userId: string, isAdmin: boolean, invoiceId?: string) => {
  await requireClientInvoicesModule(clientOrganizationId)
  const accesses = await db.select().from(invoiceClientAccess).where(and(eq(invoiceClientAccess.clientOrganizationId, clientOrganizationId), eq(invoiceClientAccess.enabled, true)))
  const assignments = accesses.length && !isAdmin ? await db.select().from(invoiceClientViewer).where(and(inArray(invoiceClientViewer.accessId, accesses.map(item => item.id)), eq(invoiceClientViewer.userId, userId))) : []
  const allowed = accesses.filter(item => isAdmin || assignments.some(assignment => assignment.accessId === item.id))
  if (!invoiceId) return allowed
  const [selected] = await db.select().from(invoice).where(and(eq(invoice.id, invoiceId), eq(invoice.clientOrganizationId, clientOrganizationId), inArray(invoice.status, ['ISSUED', 'PAID']))).limit(1)
  const access = selected && allowed.find(item => item.providerOrganizationId === selected.organizationId)
  if (!access) throw createError({ statusCode: 404, message: 'Invoice not found' })
  return access
}

export const listClientInvoices = async (clientOrganizationId: string, userId: string, isAdmin: boolean) => {
  const accesses = await requireClientAccess(clientOrganizationId, userId, isAdmin)
  if (!Array.isArray(accesses) || !accesses.length) return []
  const providers = await getPortalOrganizationsByIds(accesses.map(item => item.providerOrganizationId))
  const results = await Promise.all(accesses.map(async access => (await listInvoices(access.providerOrganizationId)).filter(item => item.clientOrganizationId === clientOrganizationId && ['ISSUED', 'PAID'].includes(item.status)).map(item => ({ id: item.id, number: item.number, status: item.status, currency: item.currency, issueDate: item.issueDate, dueDate: item.dueDate, subject: item.subject, totalMinor: item.totalMinor, outstandingMinor: item.outstandingMinor, isOverdue: item.isOverdue, daysOverdue: item.daysOverdue, supplierName: providers.find(provider => provider.id === access.providerOrganizationId)?.name ?? item.senderName, accessId: access.id }))))
  return results.flat()
}

export const getClientInvoice = async (clientOrganizationId: string, userId: string, isAdmin: boolean, id: string) => {
  const access = await requireClientAccess(clientOrganizationId, userId, isAdmin, id)
  if (Array.isArray(access)) throw createError({ statusCode: 404, message: 'Invoice not found' })
  const selected = await getInvoice(access.providerOrganizationId, id)
  const providers = await getPortalOrganizationsByIds([access.providerOrganizationId])
  const { payments: _payments, reminderCount: _reminders, lastReminderSentAt: _lastReminder, history: _history, emailDeliveries: _deliveries, ...safe } = selected
  return { ...safe, supplierName: providers[0]?.name ?? selected.senderName, accessId: access.id }
}

export const getClientInvoiceAttachment = async (clientOrganizationId: string, userId: string, isAdmin: boolean, invoiceId: string, attachmentId: string) => {
  const access = await requireClientAccess(clientOrganizationId, userId, isAdmin, invoiceId)
  if (Array.isArray(access)) throw createError({ statusCode: 404, message: 'Invoice not found' })
  return getInvoiceAttachment(access.providerOrganizationId, invoiceId, attachmentId)
}

export const listClientInvoiceViewers = async (accessId: string, clientOrganizationId: string) => {
  const [access] = await db.select().from(invoiceClientAccess).where(and(eq(invoiceClientAccess.id, accessId), eq(invoiceClientAccess.clientOrganizationId, clientOrganizationId), eq(invoiceClientAccess.enabled, true))).limit(1)
  if (!access) throw createError({ statusCode: 404, message: 'Invoice supplier not found' })
  const [members, assignments] = await Promise.all([listPortalOrganizationMembers(clientOrganizationId), db.select().from(invoiceClientViewer).where(eq(invoiceClientViewer.accessId, accessId))])
  return members.map(member => ({ id: member.id, name: member.name, email: member.email, role: member.organizationRole, assigned: ['owner', 'admin'].includes(member.organizationRole) || assignments.some(item => item.userId === member.id), fixedAccess: ['owner', 'admin'].includes(member.organizationRole) }))
}

export const setClientInvoiceViewer = async (accessId: string, clientOrganizationId: string, actorUserId: string, userId: string, assigned: boolean) => {
  const viewers = await listClientInvoiceViewers(accessId, clientOrganizationId)
  const selected = viewers.find(item => item.id === userId)
  if (!selected) throw createError({ statusCode: 400, message: 'User is not a client member' })
  if (selected.fixedAccess) throw createError({ statusCode: 400, message: 'Organization owners and admins always have invoice access' })
  if (assigned) await db.insert(invoiceClientViewer).values({ id: nanoid(), accessId, userId, createdById: actorUserId }).onConflictDoNothing()
  else await db.delete(invoiceClientViewer).where(and(eq(invoiceClientViewer.accessId, accessId), eq(invoiceClientViewer.userId, userId)))
  return listClientInvoiceViewers(accessId, clientOrganizationId)
}

const totals = (lines: Array<{ quantityMilli: number, unitPriceMinor: number, vatRateBasisPoints: number }>, payments: Array<{ amountMinor: number }>) => {
  const subtotalMinor = lines.reduce((sum, line) => sum + Math.round(line.quantityMilli * line.unitPriceMinor / 1000), 0)
  const vatMinor = lines.reduce((sum, line) => { const amount = Math.round(line.quantityMilli * line.unitPriceMinor / 1000); return sum + Math.round(amount * line.vatRateBasisPoints / 10_000) }, 0)
  const totalMinor = subtotalMinor + vatMinor; const paidMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0)
  return { subtotalMinor, vatMinor, totalMinor, paidMinor, outstandingMinor: Math.max(0, totalMinor - paidMinor) }
}

export const listInvoices = async (organizationId: string): Promise<InvoiceDto[]> => {
  await requireInvoicesEnabled(organizationId)
  const rows = await db.select().from(invoice).where(eq(invoice.organizationId, organizationId)).orderBy(desc(invoice.issueDate), desc(invoice.createdAt))
  if (!rows.length) return []
  const ids = rows.map(item => item.id)
  const [lines, payments, reminders] = await Promise.all([db.select().from(invoiceLine).where(inArray(invoiceLine.invoiceId, ids)).orderBy(asc(invoiceLine.position)), db.select().from(invoicePayment).where(inArray(invoicePayment.invoiceId, ids)).orderBy(desc(invoicePayment.paidOn)), db.select().from(invoiceEmailDelivery).where(and(inArray(invoiceEmailDelivery.invoiceId, ids), eq(invoiceEmailDelivery.purpose, 'REMINDER'), eq(invoiceEmailDelivery.status, 'SENT'))).orderBy(desc(invoiceEmailDelivery.sentAt))])
  return rows.map((row) => { const selectedLines = lines.filter(item => item.invoiceId === row.id); const selectedPayments = payments.filter(item => item.invoiceId === row.id); const amounts = totals(selectedLines, selectedPayments); const sent = reminders.filter(item => item.invoiceId === row.id); return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), issuedAt: row.issuedAt?.toISOString() ?? null, lines: selectedLines.map(line => ({ ...line, amountMinor: Math.round(line.quantityMilli * line.unitPriceMinor / 1000) })), payments: selectedPayments.map(({ id, paidOn, amountMinor, reference, note }) => ({ id, paidOn, amountMinor, reference, note })), ...amounts, ...overdue(row.dueDate, row.status, amounts.outstandingMinor), reminderCount: sent.length, lastReminderSentAt: sent[0]?.sentAt?.toISOString() ?? null, history: [], attachments: [], emailDeliveries: [] } })
}

export const getInvoice = async (organizationId: string, id: string): Promise<InvoiceDto> => {
  const selected = (await listInvoices(organizationId)).find(item => item.id === id)
  if (!selected) throw createError({ statusCode: 404, message: 'Invoice not found' })
  const [histories, attachments, deliveries] = await Promise.all([db.select({ history: invoiceHistory, actorName: user.name }).from(invoiceHistory).innerJoin(user, eq(user.id, invoiceHistory.actorUserId)).where(eq(invoiceHistory.invoiceId, id)).orderBy(desc(invoiceHistory.createdAt)), db.select({ attachment: invoiceAttachment, uploaderName: user.name }).from(invoiceAttachment).innerJoin(user, eq(user.id, invoiceAttachment.uploadedById)).where(eq(invoiceAttachment.invoiceId, id)).orderBy(desc(invoiceAttachment.createdAt)), db.select({ delivery: invoiceEmailDelivery, actorName: user.name }).from(invoiceEmailDelivery).innerJoin(user, eq(user.id, invoiceEmailDelivery.actorUserId)).where(eq(invoiceEmailDelivery.invoiceId, id)).orderBy(desc(invoiceEmailDelivery.createdAt))])
  return { ...selected, history: histories.map(({ history, actorName }) => ({ ...history, actorName, createdAt: history.createdAt.toISOString() })), attachments: attachments.map(({ attachment, uploaderName }) => ({ id: attachment.id, fileName: attachment.fileName, contentType: attachment.contentType, size: attachment.size, uploadedByName: uploaderName, createdAt: attachment.createdAt.toISOString() })), emailDeliveries: deliveries.map(({ delivery, actorName }) => ({ ...delivery, actorName, ccEmails: JSON.parse(delivery.ccEmails), providerStatusCheckedAt: delivery.providerStatusCheckedAt?.toISOString() ?? null, createdAt: delivery.createdAt.toISOString(), sentAt: delivery.sentAt?.toISOString() ?? null })) }
}

export const getNextInvoiceNumber = async (organizationId: string) => { await requireInvoicesEnabled(organizationId); const existing = await db.select({ number: invoice.number }).from(invoice).where(eq(invoice.organizationId, organizationId)).orderBy(desc(invoice.createdAt)); const used = new Set(existing.map(item => item.number)); const latest = existing.find(item => hasNumericInvoiceSequence(item.number)); let candidate = latest ? incrementInvoiceNumber(latest.number) : firstInvoiceNumber(); while (used.has(candidate)) candidate = incrementInvoiceNumber(candidate); return candidate }

export const createInvoiceInTransaction = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], organizationId: string, actorUserId: string, input: InvoiceCreateInput) => {
  const [duplicate] = await tx.select({ id: invoice.id }).from(invoice).where(and(eq(invoice.organizationId, organizationId), eq(invoice.number, input.number))).limit(1)
  if (duplicate) throw createError({ statusCode: 409, message: 'Invoice number already exists' })
  const client = await getClient(input.clientOrganizationId); if (!client || client.archivedAt) throw createError({ statusCode: 400, message: 'Client is unavailable' })
  const sender = await getOrganizationInvoiceProfile(organizationId); if (![sender.address, sender.registrationNumber, sender.vatNumber, sender.iban, sender.bic, sender.invoiceEmail].every(value => value?.trim())) throw createError({ statusCode: 409, message: 'Sender invoice details must be completed before creating an invoice' })
  const contacts = await db.select().from(billingContact).where(eq(billingContact.organizationId, input.clientOrganizationId)); const contact = input.contactId ? contacts.find(item => item.id === input.contactId) : undefined
  if (input.contactId && !contact) throw createError({ statusCode: 400, message: 'Contact does not belong to this client' })
  const invoiceId = nanoid(); const { lines, contactId: _contactId, ...values } = input
  const [created] = await tx.insert(invoice).values({ id: invoiceId, organizationId, createdById: actorUserId, ...values, senderName: sender.name, senderLogo: sender.logo, senderAddress: sender.address, senderRegistration: sender.registrationNumber, senderVatNumber: sender.vatNumber, senderIban: sender.iban, senderBic: sender.bic, recipientName: client.officialName || client.name, recipientAddress: client.address, recipientContactName: contact?.name ?? null, recipientEmail: contact?.email ?? client.invoiceEmail, recipientLocale: client.preferredLocale }).returning()
  await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId, action: 'CREATED', actorUserId }); for (const [position, line] of lines.entries()) await tx.insert(invoiceLine).values({ id: nanoid(), invoiceId, position, ...line })
  await tx.insert(invoiceClientAccess).values({ id: nanoid(), providerOrganizationId: organizationId, clientOrganizationId: input.clientOrganizationId }).onConflictDoUpdate({ target: [invoiceClientAccess.providerOrganizationId, invoiceClientAccess.clientOrganizationId], set: { enabled: true, updatedAt: new Date() } })
  return created!
}
export const createInvoice = async (organizationId: string, actorUserId: string, input: InvoiceCreateInput) => { await requireInvoicesEnabled(organizationId); return db.transaction(tx => createInvoiceInTransaction(tx, organizationId, actorUserId, input)) }

export const changeInvoiceStatus = async (organizationId: string, actorUserId: string, id: string, action: 'VOID' | 'UNVOID') => db.transaction(async (tx) => { const [current] = await tx.select().from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).limit(1); if (!current) throw createError({ statusCode: 404, message: 'Invoice not found' }); if (action === 'VOID' && !['DRAFT', 'ISSUED'].includes(current.status)) throw createError({ statusCode: 409, message: 'This invoice cannot be voided' }); if (action === 'UNVOID' && current.status !== 'VOID') throw createError({ statusCode: 409, message: 'Only voided invoices can be unvoided' }); const status = action === 'VOID' ? 'VOID' : current.issuedAt ? 'ISSUED' : 'DRAFT'; const [updated] = await tx.update(invoice).set({ status }).where(eq(invoice.id, id)).returning(); await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: action === 'VOID' ? 'VOIDED' : 'UNVOIDED', actorUserId }); return updated! })
export const updateInvoice = async (organizationId: string, actorUserId: string, id: string, input: { number: string, issueDate: string, dueDate: string, subject?: string | null, notes?: string | null }) => db.transaction(async (tx) => { const [current] = await tx.select().from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).limit(1); if (!current) throw createError({ statusCode: 404, message: 'Invoice not found' }); if (current.status !== 'DRAFT') throw createError({ statusCode: 409, message: 'Only draft invoices can be edited' }); const [updated] = await tx.update(invoice).set(input).where(eq(invoice.id, id)).returning(); await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'EDITED', actorUserId }); return updated! })
export const registerInvoicePayment = async (organizationId: string, actorUserId: string, id: string, input: { paidOn: string, amountMinor: number, reference?: string | null, note?: string | null }) => db.transaction(async (tx) => { const selected = await getInvoice(organizationId, id); if (!['ISSUED', 'PAID'].includes(selected.status) || input.amountMinor > selected.outstandingMinor) throw createError({ statusCode: 409, message: 'Payment is not valid for this invoice' }); const [created] = await tx.insert(invoicePayment).values({ id: nanoid(), invoiceId: id, createdById: actorUserId, ...input }).returning(); await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'PAYMENT_REGISTERED', actorUserId, amountMinor: input.amountMinor }); if (input.amountMinor === selected.outstandingMinor) await tx.update(invoice).set({ status: 'PAID' }).where(eq(invoice.id, id)); return created! })
export const addInvoiceAttachment = async (organizationId: string, actorUserId: string, id: string, file: { fileName: string, contentType: string, data: Uint8Array }) => db.transaction(async (tx) => { const [current] = await tx.select({ id: invoice.id }).from(invoice).where(and(eq(invoice.id, id), eq(invoice.organizationId, organizationId))).limit(1); if (!current) throw createError({ statusCode: 404, message: 'Invoice not found' }); const [created] = await tx.insert(invoiceAttachment).values({ id: nanoid(), invoiceId: id, fileName: file.fileName, contentType: file.contentType, size: file.data.length, contentBase64: Buffer.from(file.data).toString('base64'), uploadedById: actorUserId }).returning(); await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId: id, action: 'ATTACHMENT_ADDED', actorUserId, attachmentName: file.fileName }); return created! })
export const getInvoiceAttachment = async (organizationId: string, invoiceId: string, attachmentId: string) => { const [row] = await db.select({ attachment: invoiceAttachment }).from(invoiceAttachment).innerJoin(invoice, eq(invoice.id, invoiceAttachment.invoiceId)).where(and(eq(invoice.organizationId, organizationId), eq(invoice.id, invoiceId), eq(invoiceAttachment.id, attachmentId))).limit(1); if (!row) throw createError({ statusCode: 404, message: 'Attachment not found' }); return row.attachment }
export const deleteInvoiceAttachment = async (organizationId: string, actorUserId: string, invoiceId: string, attachmentId: string) => db.transaction(async (tx) => { const attachment = await getInvoiceAttachment(organizationId, invoiceId, attachmentId); await tx.delete(invoiceAttachment).where(eq(invoiceAttachment.id, attachmentId)); await tx.insert(invoiceHistory).values({ id: nanoid(), invoiceId, action: 'ATTACHMENT_REMOVED', actorUserId, attachmentName: attachment.fileName }); return { deleted: true } })
