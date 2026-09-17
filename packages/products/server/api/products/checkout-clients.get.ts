import { requireSession } from '@nuxt-customer-portal/core/server/portal'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (!session.user.emailVerified) {
    return []
  }
  return rows<{ id: string; name: string }>(
    `SELECT p.organization_id AS id,o.name FROM clients.client_profile p JOIN public.organization o ON o.id=p.organization_id JOIN public.member m ON m.organization_id=p.organization_id WHERE m.user_id=$1 AND p.client_type='organization' AND p.archived_at IS NULL ORDER BY o.name`,
    [session.user.id]
  )
})
