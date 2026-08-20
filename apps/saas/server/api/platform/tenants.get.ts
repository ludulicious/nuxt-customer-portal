import { requirePlatformSession } from '../../utils/platform-access'
import { getControlPlanePool } from '../../utils/tenant-runtime'

export default defineEventHandler(async (event) => {
  await requirePlatformSession(event)
  const result = await getControlPlanePool().query(
    `SELECT id, slug, lifecycle_status AS "lifecycleStatus", canonical_domain AS "canonicalDomain",
      database_mode AS "databaseMode", selected_modules AS "selectedModules", created_at AS "createdAt"
     FROM platform_tenant WHERE lifecycle_status <> 'DELETED' ORDER BY created_at DESC`
  )
  return result.rows
})
