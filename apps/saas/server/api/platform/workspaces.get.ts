import { requirePlatformSession } from '../../utils/platform-access'
import { getControlPlanePool } from '../../utils/workspace-runtime'
import { z } from 'zod'

const workspaceListQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  status: z.enum(['all', 'PENDING_EMAIL', 'PROVISIONING', 'ACTIVE', 'READ_ONLY', 'DELETION_SCHEDULED', 'ERROR']).default('all'),
  sortBy: z.enum(['slug', 'createdAt', 'status']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
})

export default defineEventHandler(async (event) => {
  await requirePlatformSession(event)
  const query = workspaceListQuerySchema.parse(getQuery(event))
  const conditions = ['lifecycle_status <> \'DELETED\'']
  const values: string[] = []

  if (query.search) {
    values.push(`%${query.search}%`)
    conditions.push(`(slug ILIKE $${values.length} OR canonical_domain ILIKE $${values.length})`)
  }
  if (query.status !== 'all') {
    values.push(query.status)
    conditions.push(`lifecycle_status = $${values.length}`)
  }

  const where = conditions.join(' AND ')
  const pool = getControlPlanePool()
  const countResult = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM platform_workspace WHERE ${where}`, values)
  const totalItems = Number(countResult.rows[0]?.count ?? 0)
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(query.page, totalPages)
  const sortColumn = { slug: 'slug', createdAt: 'created_at', status: 'lifecycle_status' }[query.sortBy]
  const direction = query.sortDir === 'asc' ? 'ASC' : 'DESC'
  const offset = (page - 1) * pageSize

  const result = await pool.query(
    `SELECT id, organization_id AS "organizationId", slug, lifecycle_status AS "lifecycleStatus", canonical_domain AS "canonicalDomain",
      database_mode AS "databaseMode", selected_modules AS "selectedModules", created_at AS "createdAt"
     FROM platform_workspace WHERE ${where} ORDER BY ${sortColumn} ${direction}, id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset],
  )

  return {
    items: result.rows,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  }
})
