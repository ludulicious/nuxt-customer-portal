import { resolveClientConfigurationOverride } from '@nuxt-customer-portal/core/server/utils/client-configuration'
import { createError } from 'h3'

export const getClientConfiguration = async () => {
  const config = useRuntimeConfig()
  const clients = { ...config.public.clients, ...(await resolveClientConfigurationOverride()) } as {
    allowedTypes?: string[]
    personalSelfRegistration?: boolean
    defaultModules?: string[]
  }
  const allowedTypes = clients.allowedTypes ?? ['organization']
  if (!allowedTypes.length || allowedTypes.some((type) => !['organization', 'person'].includes(type))) {
    throw new Error('clients.allowedTypes must contain organization and/or person')
  }
  const registrationMode = process.env.PORTAL_REGISTRATION_MODE || config.portalAuth.registrationMode
  if (clients.personalSelfRegistration && (!allowedTypes.includes('person') || registrationMode !== 'open')) {
    throw new Error('Personal registration requires person clients and open authentication registration')
  }
  return { ...clients, allowedTypes }
}
export const requireAllowedClientType = async (type: string) => {
  if (!(await getClientConfiguration()).allowedTypes.includes(type)) {
    throw createError({ statusCode: 403, message: 'This client type is not enabled' })
  }
}

// Server middleware awaits this promise; Nitro request hooks swallow thrown errors.
let configurationReady: Promise<string | null> = Promise.resolve('Client configuration has not initialized')
export const setClientConfigurationValidation = (ready: Promise<string | null>) => {
  configurationReady = ready
}
export const requireClientConfigurationReady = async () => {
  const error = await configurationReady
  if (error) {
    throw createError({ statusCode: 503, message: error })
  }
}
