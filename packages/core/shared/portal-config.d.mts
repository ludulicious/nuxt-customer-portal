export interface PortalLayerManifest {
  id: string
  version: string
  source: string
  dependsOn: readonly string[]
  includes?: readonly string[]
  schema?: string
  migrations?: string
  migrationSearchPath?: readonly string[]
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
  migrationSearchPath?: string[]
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
  clients: { defaultModules: string[]; allowedTypes: ('organization' | 'person')[]; personalSelfRegistration: boolean }
}

export function localPortalLayer(input: LocalPortalLayerInput): LocalPortalLayerDefinition
export function definePortalConfig(input: {
  layers: PortalLayerSource[]
  clients?: {
    defaultModules?: string[]
    allowedTypes?: ('organization' | 'person')[]
    personalSelfRegistration?: boolean
  }
}): PortalConfig
