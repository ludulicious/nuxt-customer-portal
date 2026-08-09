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
}

export function localPortalLayer(input: LocalPortalLayerInput): LocalPortalLayerDefinition
export function definePortalConfig(input: { layers: PortalLayerSource[] }): PortalConfig
export function assertCompatiblePortalVersions(manifests: PortalLayerManifest[]): void
export function resolvePortalManifests(config: PortalConfig, cwd?: string): Promise<PortalLayerManifest[]>
export function sortPortalManifests(manifests: PortalLayerManifest[]): PortalLayerManifest[]
export function inspectPortalMigrations(config: PortalConfig, options?: { cwd?: string, databaseUrl?: string }): Promise<unknown>
export function migratePortalDatabase(config: PortalConfig, options?: { cwd?: string, databaseUrl?: string }): Promise<unknown>
export function adoptLegacyMigrations(config: PortalConfig, options?: { cwd?: string, databaseUrl?: string, apply?: boolean }): Promise<unknown>
