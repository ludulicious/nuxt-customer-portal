import { randomUUID } from 'node:crypto'
import { canTransitionTenant, isTenantLifecycleState } from '../../../../utils/lifecycle'
import { requirePlatformSession } from '../../../../utils/platform-access'
import { getControlPlanePool } from '../../../../utils/tenant-runtime'

export default defineEventHandler(async (event) => {
  const session = await requirePlatformSession(event)
  const tenantId = getRouterParam(event, 'id')
  const body = await readBody<{ status?: string }>(event)
  if (!tenantId || !body.status || !isTenantLifecycleState(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid lifecycle status required' })
  }

  const client = await getControlPlanePool().connect()
  try {
    await client.query('BEGIN')
    const selected = await client.query<{ lifecycle_status: string }>('SELECT lifecycle_status FROM platform_tenant WHERE id = $1 FOR UPDATE', [tenantId])
    const current = selected.rows[0]?.lifecycle_status
    if (!current || !isTenantLifecycleState(current)) throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
    if (!canTransitionTenant(current, body.status)) {
      throw createError({ statusCode: 409, statusMessage: `Cannot transition tenant from ${current} to ${body.status}` })
    }
    await client.query('UPDATE platform_tenant SET lifecycle_status = $2, updated_at = now() WHERE id = $1', [tenantId, body.status])
    await client.query(
      'INSERT INTO platform_lifecycle_event (id, tenant_id, from_status, to_status, actor_user_id) VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), tenantId, current, body.status, session.user.id]
    )
    await client.query('COMMIT')
    return { tenantId, lifecycleStatus: body.status }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})
