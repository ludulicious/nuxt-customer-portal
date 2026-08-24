import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  const { bootstrap, refreshBootstrap } = usePortalSettings()
  if (!bootstrap.value) {
    await refreshBootstrap().catch(() => null)
  }
  const state = bootstrap.value
  if (!state) {
    return
  }

  const bootstrapRoutes = ['/signup', '/verify-email', '/login', '/forgot-password', '/reset-password']
  const publicConfiguredRoutes = ['/', '/terms', '/privacy', '/contact']

  if (!state.adminExists) {
    if (['/signup', '/verify-email'].includes(to.path)) {
      return
    }
    return navigateTo('/signup', { replace: true })
  }

  if (!state.completed) {
    const { data: session } = await authClient.useSession(useFetch)
    if (to.path === '/onboarding' || bootstrapRoutes.includes(to.path)) {
      return
    }
    if (session.value?.user?.role === 'admin') {
      return navigateTo('/onboarding', { replace: true })
    }
    return navigateTo('/login', { replace: true })
  }

  if (to.path === '/onboarding') {
    return navigateTo('/admin/portal-settings', { replace: true })
  }
  if (publicConfiguredRoutes.includes(to.path)) {
    return
  }

  const settings = useState<{ enabledModules?: string[] } | null>('portal-runtime-settings')
  const routeModules: Record<string, string[]> = {
    timesheets: ['/timesheets', '/admin/timesheets'],
    invoices: ['/invoices', '/admin/invoices'],
    'service-requests': ['/requests', '/admin/requests']
  }
  for (const [moduleId, prefixes] of Object.entries(routeModules)) {
    if (!settings.value?.enabledModules?.includes(moduleId) && prefixes.some((prefix) => to.path.startsWith(prefix))) {
      return navigateTo('/dashboard', { replace: true })
    }
  }
})
