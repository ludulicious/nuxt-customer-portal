export interface ClientConfigurationOverride {
  allowedTypes: ('organization' | 'person')[]
  personalSelfRegistration: boolean
}
let resolver: (() => Promise<ClientConfigurationOverride>) | undefined
export const registerClientConfigurationResolver = (value: typeof resolver) => {
  resolver = value
}
export const resolveClientConfigurationOverride = () => resolver?.()
