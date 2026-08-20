export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const hostname = useRequestURL().hostname.toLowerCase()
  const platformHost = String(config.public.platformHost).toLowerCase()
  const platformDomain = String(config.public.platformDomain).toLowerCase()

  if (hostname !== platformHost && hostname !== platformDomain) {
    config.public.portalAuth.githubEnabled = false
    config.public.portalAuth.googleEnabled = false
  }
})
