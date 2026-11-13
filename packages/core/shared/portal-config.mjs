const assertString = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`)
  }
  return value
}

export const localPortalLayer = (input) => ({
  kind: 'local',
  id: assertString(input.id, 'Local layer id'),
  source: assertString(input.source, 'Local layer source'),
  version: input.version ?? '0.0.0-local',
  schema: input.schema,
  migrations: input.migrations,
  migrationSearchPath: input.migrationSearchPath,
  dependsOn: [...(input.dependsOn ?? [])]
})

export const definePortalConfig = ({ layers, clients }) => {
  const allowedTypes = clients?.allowedTypes ?? ['organization']
  if (!allowedTypes.length || allowedTypes.some((type) => !['organization', 'person'].includes(type))) {
    throw new Error('clients.allowedTypes must contain organization and/or person')
  }
  if (clients?.personalSelfRegistration && !allowedTypes.includes('person')) {
    throw new Error('Personal registration requires person clients')
  }
  if (!Array.isArray(layers) || !layers.length) {
    throw new Error('Portal config must contain at least one layer')
  }
  return {
    layers,
    clients: {
      defaultModules: [...(clients?.defaultModules ?? [])],
      allowedTypes: [...(clients?.allowedTypes ?? ['organization'])],
      personalSelfRegistration: clients?.personalSelfRegistration ?? false
    },
    nuxtLayers: layers.map((layer) => (typeof layer === 'string' ? layer : layer.source))
  }
}
