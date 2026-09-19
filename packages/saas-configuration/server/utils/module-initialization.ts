import type { PortalSettings } from '../../shared/settings'

interface QueryClient {
  query: (text: string, values?: unknown[]) => Promise<unknown>
}

export async function initializeEnabledModules(client: QueryClient, settings: PortalSettings, actorId: string) {
  if (!settings.enabledModules.includes('products')) {
    return
  }
  await client.query(
    `INSERT INTO products.store(organization_id,actor_id)
     SELECT id,$1 FROM public.organization WHERE organization_type='PROVIDER'
     ON CONFLICT(id) DO NOTHING`,
    [actorId]
  )
}
