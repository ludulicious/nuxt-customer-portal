import { getRequestHost, sendRedirect } from 'h3'
import { normalizeHostname } from '../utils/hostname'
import { establishSaasRequestContext } from '../utils/tenant-runtime'
import { platformAuth } from '../utils/platform-auth'
import { getTenantAuth } from '../utils/tenant-auth'

export default defineEventHandler(async (event) => {
  const hostname = normalizeHostname(getRequestHost(event, { xForwardedHost: false }))
  if (event.path.startsWith('/_nuxt/') || event.path === '/favicon.ico' || event.path === '/api/health') return
  const context = await establishSaasRequestContext(hostname)
  if (context.mode === 'platform') context.auth = platformAuth
  if (context.mode === 'tenant' && context.tenant) context.auth = getTenantAuth(context.tenant)

  if (context.mode === 'tenant' && (event.path.startsWith('/platform') || event.path.startsWith('/api/platform'))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const platformPaths = ['/', '/platform', '/login', '/signup', '/forgot-password', '/verify-email', '/api/auth', '/api/platform', '/api/health']
  if (context.mode === 'platform' && !platformPaths.some(path => event.path === path || event.path.startsWith(`${path}/`))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (context.mode === 'tenant' && context.tenant?.canonicalDomain !== hostname) {
    return sendRedirect(event, `https://${context.tenant?.canonicalDomain}${event.path}`, 308)
  }

  const moduleRoutes: Record<string, string[]> = {
    timesheets: ['/timesheets', '/admin/timesheets', '/api/timesheets'],
    invoices: ['/invoices', '/admin/invoices', '/api/invoices', '/api/invoice-timesheets'],
    'service-requests': ['/requests', '/admin/requests', '/api/service-requests']
  }
  const disabledModule = Object.entries(moduleRoutes).find(([module, prefixes]) =>
    !context.tenant?.enabledModules?.includes(module) && prefixes.some(prefix => event.path.startsWith(prefix))
  )
  if (context.mode === 'tenant' && disabledModule) {
    throw createError({ statusCode: 404, statusMessage: 'Module is not enabled for this tenant' })
  }

  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(event.method)
  const allowedReadOnlyPath = event.path.startsWith('/api/auth/') || event.path.startsWith('/api/export/')
  if (context.tenant?.lifecycleStatus === 'READ_ONLY' && !safeMethod && !allowedReadOnlyPath) {
    throw createError({ statusCode: 423, statusMessage: 'Tenant is read-only' })
  }
})
