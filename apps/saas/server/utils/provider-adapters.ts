type StoredSecret = { reference: string }
type ProvisionedDatabase = { url: string, resourceId: string }

const requiredEndpoint = (name: string, value: string | undefined) => {
  if (!value) throw createError({ statusCode: 503, statusMessage: `${name} adapter is not configured` })
  return value
}

const providerHeaders = () => {
  const token = process.env.SAAS_PROVIDER_ADAPTER_TOKEN
  return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }
}

const secretPath = (kind: 'database' | 'auth', tenantId: string) =>
  `${kind === 'database' ? 'tenant-databases' : 'tenant-auth-secrets'}/${encodeURIComponent(tenantId)}`

const storeTenantSecret = async (kind: 'database' | 'auth', tenantId: string, value: string): Promise<StoredSecret> => {
  const endpoint = requiredEndpoint('Secret storage', process.env.SAAS_SECRET_STORE_ENDPOINT)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${secretPath(kind, tenantId)}`, {
    method: 'PUT',
    headers: providerHeaders(),
    body: JSON.stringify({ value })
  })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Secret storage failed' })
  return await response.json() as StoredSecret
}

const deleteTenantSecret = async (kind: 'database' | 'auth', tenantId: string) => {
  const endpoint = process.env.SAAS_SECRET_STORE_ENDPOINT
  if (!endpoint) return
  await fetch(`${endpoint.replace(/\/$/, '')}/${secretPath(kind, tenantId)}`, {
    method: 'DELETE',
    headers: providerHeaders()
  }).catch(() => undefined)
}

const resolveTenantSecret = async (kind: 'database' | 'auth', tenantId: string) => {
  const endpoint = requiredEndpoint('Secret storage', process.env.SAAS_SECRET_STORE_ENDPOINT)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${secretPath(kind, tenantId)}`, { headers: providerHeaders() })
  if (!response.ok) throw createError({ statusCode: 503, statusMessage: 'Tenant secret is unavailable' })
  const secret = await response.json() as { value?: string }
  if (!secret.value) throw createError({ statusCode: 503, statusMessage: 'Tenant secret is invalid' })
  return secret.value
}

export const storeTenantDatabaseSecret = (tenantId: string, databaseUrl: string) => storeTenantSecret('database', tenantId, databaseUrl)
export const storeTenantAuthSecret = (tenantId: string, authSecret: string) => storeTenantSecret('auth', tenantId, authSecret)

export const deleteTenantDatabaseSecret = (tenantId: string) => deleteTenantSecret('database', tenantId)
export const deleteTenantAuthSecret = (tenantId: string) => deleteTenantSecret('auth', tenantId)

export const resolveTenantDatabaseSecret = (tenantId: string) => resolveTenantSecret('database', tenantId)
export const resolveTenantAuthSecret = (tenantId: string) => resolveTenantSecret('auth', tenantId)

export const provisionTenantDatabase = async (tenantId: string, slug: string): Promise<ProvisionedDatabase> => {
  const endpoint = requiredEndpoint('Database provisioning', process.env.SAAS_DATABASE_PROVIDER_ENDPOINT)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/databases`, {
    method: 'POST',
    headers: providerHeaders(),
    body: JSON.stringify({ tenantId, slug })
  })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Database provisioning failed' })
  return await response.json() as ProvisionedDatabase
}
