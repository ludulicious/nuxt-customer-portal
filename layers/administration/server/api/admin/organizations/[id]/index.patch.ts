import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { organization as organizationTable } from '#portal/server/db/schema/auth-schema'
import { auth } from '#portal/server/utils/auth'
import { db } from '#portal/server/utils/db'
import type { Organization, SessionUser } from '#types'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalAdminOrganizationsByIdPatch',
    summary: 'Update an organization',
    description: 'Update an organization. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  officialCompanyName: z.string().trim().min(1).max(200),
  logo: z.string().max(2_800_000).refine(value => !value || /^data:image\/(png|jpeg|gif|webp);base64,/.test(value) || z.string().url().safeParse(value).success)
})

export default defineEventHandler(async (event): Promise<Organization> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  if ((session.user as SessionUser).role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'Organization ID is required' })
  }

  const parsed = updateOrganizationSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'A valid name and slug are required' })
  }

  const [existing] = await db
    .select({ id: organizationTable.id, metadata: organizationTable.metadata })
    .from(organizationTable)
    .where(eq(organizationTable.id, organizationId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  const [slugOwner] = await db
    .select({ id: organizationTable.id })
    .from(organizationTable)
    .where(and(eq(organizationTable.slug, parsed.data.slug), ne(organizationTable.id, organizationId)))
    .limit(1)

  if (slugOwner) {
    throw createError({ statusCode: 409, message: 'Organization slug is already taken' })
  }

  let metadata: Record<string, unknown>
  try {
    metadata = existing.metadata ? JSON.parse(existing.metadata) as Record<string, unknown> : {}
  } catch {
    metadata = {}
  }
  metadata.officialCompanyName = parsed.data.officialCompanyName

  const [updated] = await db
    .update(organizationTable)
    .set({ name: parsed.data.name, slug: parsed.data.slug, logo: parsed.data.logo || null, metadata: JSON.stringify(metadata) })
    .where(eq(organizationTable.id, organizationId))
    .returning()

  return updated as Organization
})
