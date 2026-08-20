import { getRequestHost, getRequestURL, sendRedirect } from 'h3'
import { normalizeHostname } from '../utils/hostname'
import { establishSaasRequestContext } from '../utils/tenant-runtime'
import { platformAuth } from '../utils/platform-auth'
import { getTenantAuth } from '../utils/tenant-auth'

export default defineEventHandler(async (event) => {
  const hostname = normalizeHostname(getRequestHost(event, { xForwardedHost: false }))
  const pathname = getRequestURL(event).pathname
  if (pathname.startsWith('/_nuxt/') || pathname === '/favicon.ico' || pathname === '/api/health') return
  const context = await establishSaasRequestContext(hostname)
  if (context.mode === 'platform') context.auth = platformAuth
  if (context.mode === 'tenant' && context.tenant) context.auth = getTenantAuth(context.tenant)

  if (context.mode === 'tenant' && (pathname.startsWith('/platform') || pathname.startsWith('/api/platform'))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const platformPaths = ['/', '/dashboard', '/platform', '/login', '/signup', '/forgot-password', '/verify-email', '/api/auth', '/api/platform', '/api/health']
  if (context.mode === 'platform' && !platformPaths.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
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
    !context.tenant?.enabledModules?.includes(module) && prefixes.some(prefix => pathname.startsWith(prefix))
  )
  if (context.mode === 'tenant' && disabledModule) {
    throw createError({ statusCode: 404, statusMessage: 'Module is not enabled for this tenant' })
  }

  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(event.method)
  const allowedReadOnlyPath = pathname.startsWith('/api/auth/') || pathname.startsWith('/api/export/')
  if (context.tenant?.lifecycleStatus === 'READ_ONLY' && !safeMethod && !allowedReadOnlyPath) {
    throw createError({ statusCode: 423, statusMessage: 'Tenant is read-only' })
  }
})
