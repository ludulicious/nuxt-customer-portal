export default defineNuxtRouteMiddleware(async (to) => {
  const guardedPaths = ['/dashboard', '/platform/workspaces']
  if (!guardedPaths.includes(to.path)) return

  const config = useRuntimeConfig()
  const requestUrl = useRequestURL()
  const platformHost = String(config.public.platformHost || 'platform.localhost').toLowerCase()
  const platformDomain = String(config.public.platformDomain || platformHost).toLowerCase()
  if (![platformHost, platformDomain].includes(requestUrl.hostname.toLowerCase())) return

  try {
    const response = await $fetch<{ pagination?: { totalItems?: number } }>('/api/platform/workspaces', { query: { page: 1, pageSize: 1 } })
    if ((response.pagination?.totalItems ?? 0) === 0) return navigateTo('/platform/onboarding')
  } catch {
    // Keep the dashboard reachable when the workspace check is temporarily unavailable.
  }
})
