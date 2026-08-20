import { randomUUID } from 'node:crypto'
import { canTransitionWorkspace, isWorkspaceLifecycleState } from '../../../../utils/lifecycle'
import { requirePlatformSession } from '../../../../utils/platform-access'
import { getControlPlanePool } from '../../../../utils/workspace-runtime'

export default defineEventHandler(async (event) => {
  const session = await requirePlatformSession(event)
  const workspaceId = getRouterParam(event, 'id')
  const body = await readBody<{ status?: string }>(event)
  if (!workspaceId || !body.status || !isWorkspaceLifecycleState(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid lifecycle status required' })
  }

  const client = await getControlPlanePool().connect()
  try {
    await client.query('BEGIN')
    const selected = await client.query<{ lifecycle_status: string }>('SELECT lifecycle_status FROM platform_workspace WHERE id = $1 FOR UPDATE', [workspaceId])
    const current = selected.rows[0]?.lifecycle_status
    if (!current || !isWorkspaceLifecycleState(current)) throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
    if (!canTransitionWorkspace(current, body.status)) {
      throw createError({ statusCode: 409, statusMessage: `Cannot transition workspace from ${current} to ${body.status}` })
    }
    await client.query('UPDATE platform_workspace SET lifecycle_status = $2, updated_at = now() WHERE id = $1', [workspaceId, body.status])
    await client.query(
      'INSERT INTO platform_lifecycle_event (id, workspace_id, from_status, to_status, actor_user_id) VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), workspaceId, current, body.status, session.user.id]
    )
    await client.query('COMMIT')
    return { workspaceId, lifecycleStatus: body.status }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})
