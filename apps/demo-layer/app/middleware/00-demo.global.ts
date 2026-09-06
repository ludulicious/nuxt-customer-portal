export default defineNuxtRouteMiddleware((to) => {
  if (useRuntimeConfig().public.portalDemo?.enabled && ['/login', '/signup'].includes(to.path)) {
    return navigateTo('/dashboard', { replace: true })
  }
})
