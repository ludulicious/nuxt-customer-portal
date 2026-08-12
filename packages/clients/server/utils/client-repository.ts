import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { invitation, member, organization, user } from '@nuxt-customer-portal/core/schema'
import { clientModule, clientProfile } from '@nuxt-customer-portal/clients/server/db/schema/clients'
import type { GenericClientDto, ClientListResponse } from '@nuxt-customer-portal/clients/shared/types/client'
import type { ClientCreateInput, GenericClientListQuery, ClientUpdateInput } from './client-validation'

const normalizeNullable = (value: string | null | undefined) => value?.trim() || null

const clientSelection = {
  organizationId: organization.id,
  name: organization.name,
  slug: organization.slug,
  logo: organization.logo,
  createdAt: organization.createdAt,
  officialName: clientProfile.officialName,
  address: clientProfile.address,
  registrationNumber: clientProfile.registrationNumber,
  vatNumber: clientProfile.vatNumber,
  invoiceEmail: clientProfile.invoiceEmail,
  preferredLocale: clientProfile.preferredLocale,
  archivedAt: clientProfile.archivedAt
}

interface ClientRow {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  createdAt: Date
  officialName: string
  address: string
  registrationNumber: string | null
  vatNumber: string | null
  invoiceEmail: string | null
  preferredLocale: string
  archivedAt: Date | null
}

const hydrateClients = async (rows: ClientRow[]): Promise<GenericClientDto[]> => {
  if (!rows.length) return []
  const ids = rows.map(row => row.organizationId as string)
  const [modules, members, invitations] = await Promise.all([
    db.select().from(clientModule).where(inArray(clientModule.organizationId, ids)),
    db.select({
      id: member.id, organizationId: member.organizationId, userId: member.userId, role: member.role,
      phone: member.phone, jobTitle: member.jobTitle, name: user.name, email: user.email, image: user.image
    }).from(member).innerJoin(user, eq(user.id, member.userId)).where(inArray(member.organizationId, ids)).orderBy(asc(user.name), asc(user.email)),
    db.select({
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt
    }).from(invitation).where(and(inArray(invitation.organizationId, ids), eq(invitation.status, 'pending'))).orderBy(asc(invitation.email))
  ])
  return rows.map(row => ({
    id: row.organizationId,
    organizationId: row.organizationId,
    name: row.name,
    slug: row.slug,
    logo: row.logo,
    officialName: row.officialName,
    address: row.address,
    registrationNumber: row.registrationNumber,
    vatNumber: row.vatNumber,
    invoiceEmail: row.invoiceEmail,
    preferredLocale: row.preferredLocale === 'en' ? 'en' : 'nl',
    archivedAt: row.archivedAt?.toISOString() ?? null,
    modules: modules.filter(item => item.organizationId === row.organizationId).map(item => ({ moduleId: item.moduleId, enabled: item.enabled })),
    members: members.filter(item => item.organizationId === row.organizationId).map(item => ({
      id: item.id, userId: item.userId, name: item.name, email: item.email, image: item.image,
      role: item.role, phone: item.phone, jobTitle: item.jobTitle
    })),
    invitations: invitations.filter(item => item.organizationId === row.organizationId).map(item => ({
      id: item.id,
      email: item.email,
      role: item.role || 'member',
      status: item.status,
      expiresAt: item.expiresAt.toISOString()
    }))
  }))
}

export const listGenericClientsPage = async (query: GenericClientListQuery): Promise<ClientListResponse> => {
  const conditions = [
    eq(organization.organizationType, 'CLIENT'),
    query.status === 'archived' ? isNotNull(clientProfile.archivedAt) : query.status === 'active' ? isNull(clientProfile.archivedAt) : undefined,
    query.search ? or(ilike(organization.name, `%${query.search}%`), ilike(clientProfile.officialName, `%${query.search}%`), ilike(organization.slug, `%${query.search}%`)) : undefined,
    query.moduleId ? inArray(organization.id, db.select({ id: clientModule.organizationId }).from(clientModule).where(and(eq(clientModule.moduleId, query.moduleId), eq(clientModule.enabled, true)))) : undefined
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition))
  const where = and(...conditions)
  const [countRow] = await db.select({ total: count() }).from(organization).innerJoin(clientProfile, eq(clientProfile.organizationId, organization.id)).where(where)
  const direction = query.sortDir === 'desc' ? desc : asc
  const primary = query.sortBy === 'createdAt' ? organization.createdAt : query.sortBy === 'status' ? clientProfile.archivedAt : organization.name
  const rows = await db.select(clientSelection).from(organization).innerJoin(clientProfile, eq(clientProfile.organizationId, organization.id))
    .where(where).orderBy(direction(primary), asc(organization.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize)
  const totalItems = Number(countRow?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize))
  return {
    items: await hydrateClients(rows),
    pagination: { page: query.page, pageSize: query.pageSize, totalItems, totalPages, hasPrevious: query.page > 1, hasNext: query.page < totalPages }
  }
}

export const getClient = async (organizationId: string): Promise<GenericClientDto | null> => {
  const rows = await db.select(clientSelection).from(organization).innerJoin(clientProfile, eq(clientProfile.organizationId, organization.id))
    .where(and(eq(organization.id, organizationId), eq(organization.organizationType, 'CLIENT'))).limit(1)
  return (await hydrateClients(rows))[0] ?? null
}

export const listSelectableClients = async (moduleId?: string) => {
  const page = await listGenericClientsPage({ status: 'active', moduleId, page: 1, pageSize: 100, sortBy: 'name', sortDir: 'asc' })
  return page.items
}

export const createClient = async (actorUserId: string, input: ClientCreateInput) => db.transaction(async (tx) => {
  const [existingSlug] = await tx.select({ id: organization.id }).from(organization).where(eq(organization.slug, input.slug)).limit(1)
  if (existingSlug) throw createError({ statusCode: 409, message: 'Organization slug already exists', data: { field: 'slug' } })
  const organizationId = nanoid()
  await tx.insert(organization).values({ id: organizationId, name: input.name, slug: input.slug, organizationType: 'CLIENT', createdAt: new Date() })
  await tx.insert(clientProfile).values({
    organizationId, officialName: input.officialName, address: input.address,
    registrationNumber: normalizeNullable(input.registrationNumber), vatNumber: normalizeNullable(input.vatNumber),
    invoiceEmail: normalizeNullable(input.invoiceEmail), preferredLocale: input.preferredLocale
  })
  for (const moduleId of [...new Set(input.moduleIds ?? [])]) {
    await tx.insert(clientModule).values({ id: nanoid(), organizationId, moduleId, enabledById: actorUserId })
  }
  return organizationId
})

export const updateClient = async (organizationId: string, input: ClientUpdateInput) => db.transaction(async (tx) => {
  const [selected] = await tx.select({ id: organization.id }).from(organization).where(and(eq(organization.id, organizationId), eq(organization.organizationType, 'CLIENT'))).limit(1)
  if (!selected) throw createError({ statusCode: 404, message: 'Client not found' })
  const orgValues: Record<string, unknown> = {}
  if (input.name !== undefined) orgValues.name = input.name
  if (Object.keys(orgValues).length) await tx.update(organization).set(orgValues).where(eq(organization.id, organizationId))
  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (input.officialName !== undefined) values.officialName = input.officialName
  if (input.address !== undefined) values.address = input.address
  if (input.registrationNumber !== undefined) values.registrationNumber = normalizeNullable(input.registrationNumber)
  if (input.vatNumber !== undefined) values.vatNumber = normalizeNullable(input.vatNumber)
  if (input.invoiceEmail !== undefined) values.invoiceEmail = normalizeNullable(input.invoiceEmail)
  if (input.preferredLocale !== undefined) values.preferredLocale = input.preferredLocale
  await tx.update(clientProfile).set(values).where(eq(clientProfile.organizationId, organizationId))
})

export const setClientArchived = async (organizationId: string, actorUserId: string, archived: boolean) => {
  const [updated] = await db.update(clientProfile).set({ archivedAt: archived ? new Date() : null, archivedById: archived ? actorUserId : null, updatedAt: new Date() })
    .where(eq(clientProfile.organizationId, organizationId)).returning({ organizationId: clientProfile.organizationId })
  if (!updated) throw createError({ statusCode: 404, message: 'Client not found' })
}

export const setClientModule = async (organizationId: string, actorUserId: string, moduleId: string, enabled: boolean) => {
  const selected = await getClient(organizationId)
  if (!selected) throw createError({ statusCode: 404, message: 'Client not found' })
  if (selected.archivedAt && enabled) throw createError({ statusCode: 409, message: 'Archived clients cannot enable modules' })
  await db.insert(clientModule).values({
    id: nanoid(), organizationId, moduleId, enabled, enabledAt: new Date(), enabledById: actorUserId,
    disabledAt: enabled ? null : new Date(), disabledById: enabled ? null : actorUserId
  }).onConflictDoUpdate({
    target: [clientModule.organizationId, clientModule.moduleId],
    set: { enabled, enabledAt: enabled ? new Date() : undefined, enabledById: enabled ? actorUserId : undefined, disabledAt: enabled ? null : new Date(), disabledById: enabled ? null : actorUserId, updatedAt: new Date() }
  })
}

export const requireClientModuleEnabled = async (organizationId: string, moduleId: string) => {
  const [enabled] = await db.select({ id: clientModule.id }).from(clientModule).innerJoin(clientProfile, eq(clientProfile.organizationId, clientModule.organizationId)).where(and(
    eq(clientModule.organizationId, organizationId), eq(clientModule.moduleId, moduleId), eq(clientModule.enabled, true), isNull(clientProfile.archivedAt)
  )).limit(1)
  if (!enabled) throw createError({ statusCode: 403, message: `Module ${moduleId} is not enabled for this client` })
}

export const getGenericClientDeletionEligibility = async (organizationId: string) => {
  const selected = await getClient(organizationId)
  if (!selected) throw createError({ statusCode: 404, message: 'Client not found' })
  return { organizationId, clientName: selected.name, canDelete: selected.members.length === 0 && selected.modules.length === 0, memberCount: selected.members.length, moduleCount: selected.modules.length }
}

export const deleteGenericClient = async (organizationId: string, clientName: string) => db.transaction(async (tx) => {
  const [selected] = await tx.select({ name: organization.name }).from(organization).where(and(eq(organization.id, organizationId), eq(organization.organizationType, 'CLIENT'))).limit(1)
  if (!selected) throw createError({ statusCode: 404, message: 'Client not found' })
  if (selected.name !== clientName) throw createError({ statusCode: 400, message: 'Client name does not match' })
  const [memberCount] = await tx.select({ members: count() }).from(member).where(eq(member.organizationId, organizationId))
  const [moduleCount] = await tx.select({ modules: count() }).from(clientModule).where(eq(clientModule.organizationId, organizationId))
  if (Number(memberCount?.members ?? 0) || Number(moduleCount?.modules ?? 0)) throw createError({ statusCode: 409, message: 'Client still has members or module history' })
  await tx.delete(clientProfile).where(eq(clientProfile.organizationId, organizationId))
  await tx.delete(organization).where(eq(organization.id, organizationId))
})
