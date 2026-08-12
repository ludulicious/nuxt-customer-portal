export interface PortalLayerManifest {
  id: string
  version: string
  source: string
  dependsOn: readonly string[]
  includes?: readonly string[]
  schema?: string
  migrations?: string
  root?: string
  local?: boolean
  clientModuleId?: string
}

export interface LocalPortalLayerInput {
  id: string
  source: string
  version?: string
  schema?: string
  migrations?: string
  dependsOn?: string[]
}

export interface LocalPortalLayerDefinition extends LocalPortalLayerInput {
  kind: 'local'
  version: string
  dependsOn: string[]
}

export type PortalLayerSource = string | LocalPortalLayerDefinition

export interface PortalConfig {
  layers: PortalLayerSource[]
  nuxtLayers: string[]
  clients: { defaultModules: string[] }
}

export function localPortalLayer(input: LocalPortalLayerInput): LocalPortalLayerDefinition
export function definePortalConfig(input: { layers: PortalLayerSource[], clients?: { defaultModules?: string[] } }): PortalConfig
export function assertCompatiblePortalVersions(manifests: PortalLayerManifest[]): void
export function resolvePortalManifests(config: PortalConfig, cwd?: string): Promise<PortalLayerManifest[]>
export function sortPortalManifests(manifests: PortalLayerManifest[]): PortalLayerManifest[]
export function inspectPortalMigrations(config: PortalConfig, options?: { cwd?: string, databaseUrl?: string }): Promise<unknown>
export function migratePortalDatabase(config: PortalConfig, options?: { cwd?: string, databaseUrl?: string }): Promise<unknown>
export function adoptLegacyMigrations(config: PortalConfig, options?: { cwd?: string, databaseUrl?: string, apply?: boolean }): Promise<unknown>
export function migrateGenericClients(config: PortalConfig, options: { owner: string, cwd?: string, databaseUrl?: string, apply?: boolean, backupConfirmed?: boolean }): Promise<unknown>
export function seedPortalOwner(options: { organizationName: string, organizationSlug: string, userName: string, userEmail: string, userPassword: string, databaseUrl?: string }): Promise<unknown>
