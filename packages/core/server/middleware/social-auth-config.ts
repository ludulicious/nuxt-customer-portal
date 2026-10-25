import { defineEventHandler } from 'h3'
import { socialAuthProviders } from '../../shared/social-auth'

export default defineEventHandler((event) => {
  // Nitro gives each request its own runtime config. Replace build-time defaults
  // and public overrides with the same availability checks used by Better Auth.
  Object.assign(useRuntimeConfig(event).public.portalAuth, socialAuthProviders(process.env))
})
