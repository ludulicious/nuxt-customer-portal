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

const secretPath = (kind: 'database' | 'auth', workspaceId: string) =>
  `${kind === 'database' ? 'workspace-databases' : 'workspace-auth-secrets'}/${encodeURIComponent(workspaceId)}`

const storeWorkspaceSecret = async (kind: 'database' | 'auth', workspaceId: string, value: string): Promise<StoredSecret> => {
  const endpoint = requiredEndpoint('Secret storage', process.env.SAAS_SECRET_STORE_ENDPOINT)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${secretPath(kind, workspaceId)}`, {
    method: 'PUT',
    headers: providerHeaders(),
    body: JSON.stringify({ value })
  })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Secret storage failed' })
  return await response.json() as StoredSecret
}

const deleteWorkspaceSecret = async (kind: 'database' | 'auth', workspaceId: string) => {
  const endpoint = process.env.SAAS_SECRET_STORE_ENDPOINT
  if (!endpoint) return
  await fetch(`${endpoint.replace(/\/$/, '')}/${secretPath(kind, workspaceId)}`, {
    method: 'DELETE',
    headers: providerHeaders()
  }).catch(() => undefined)
}

const resolveWorkspaceSecret = async (kind: 'database' | 'auth', workspaceId: string) => {
  const endpoint = requiredEndpoint('Secret storage', process.env.SAAS_SECRET_STORE_ENDPOINT)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${secretPath(kind, workspaceId)}`, { headers: providerHeaders() })
  if (!response.ok) throw createError({ statusCode: 503, statusMessage: 'Workspace secret is unavailable' })
  const secret = await response.json() as { value?: string }
  if (!secret.value) throw createError({ statusCode: 503, statusMessage: 'Workspace secret is invalid' })
  return secret.value
}

export const storeWorkspaceDatabaseSecret = (workspaceId: string, databaseUrl: string) => storeWorkspaceSecret('database', workspaceId, databaseUrl)
export const storeWorkspaceAuthSecret = (workspaceId: string, authSecret: string) => storeWorkspaceSecret('auth', workspaceId, authSecret)

export const deleteWorkspaceDatabaseSecret = (workspaceId: string) => deleteWorkspaceSecret('database', workspaceId)
export const deleteWorkspaceAuthSecret = (workspaceId: string) => deleteWorkspaceSecret('auth', workspaceId)

export const resolveWorkspaceDatabaseSecret = (workspaceId: string) => resolveWorkspaceSecret('database', workspaceId)
export const resolveWorkspaceAuthSecret = (workspaceId: string) => resolveWorkspaceSecret('auth', workspaceId)

export const provisionWorkspaceDatabase = async (workspaceId: string, slug: string): Promise<ProvisionedDatabase> => {
  const endpoint = requiredEndpoint('Database provisioning', process.env.SAAS_DATABASE_PROVIDER_ENDPOINT)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/databases`, {
    method: 'POST',
    headers: providerHeaders(),
    body: JSON.stringify({ workspaceId, slug })
  })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Database provisioning failed' })
  return await response.json() as ProvisionedDatabase
}
