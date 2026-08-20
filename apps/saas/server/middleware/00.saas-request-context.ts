import { getRequestHost, getRequestURL, sendRedirect } from 'h3'
import { normalizeHostname } from '../utils/hostname'
import { establishSaasRequestContext } from '../utils/workspace-runtime'
import { platformAuth } from '../utils/platform-auth'
import { getWorkspaceAuth } from '../utils/workspace-auth'

export default defineEventHandler(async (event) => {
  const hostname = normalizeHostname(getRequestHost(event, { xForwardedHost: false }))
  const pathname = getRequestURL(event).pathname
  if (pathname.startsWith('/_nuxt/') || pathname === '/favicon.ico' || pathname === '/api/health') return
  const context = await establishSaasRequestContext(hostname)
  if (context.mode === 'platform') context.auth = platformAuth
  if (context.mode === 'workspace' && context.workspace) context.auth = getWorkspaceAuth(context.workspace)

  if (context.mode === 'workspace' && (pathname.startsWith('/platform') || pathname.startsWith('/api/platform'))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  if (context.mode === 'workspace' && context.workspace?.canonicalDomain !== hostname) {
    return sendRedirect(event, `https://${context.workspace?.canonicalDomain}${event.path}`, 308)
  }

  const moduleRoutes: Record<string, string[]> = {
    timesheets: ['/timesheets', '/admin/timesheets', '/api/timesheets'],
    invoices: ['/invoices', '/admin/invoices', '/api/invoices', '/api/invoice-timesheets'],
    'service-requests': ['/requests', '/admin/requests', '/api/service-requests'],
  }
  const disabledModule = Object.entries(moduleRoutes).find(([module, prefixes]) =>
    !context.workspace?.enabledModules?.includes(module) && prefixes.some(prefix => pathname.startsWith(prefix))
  )
  if (context.mode === 'workspace' && disabledModule) {
    throw createError({ statusCode: 404, statusMessage: 'Module is not enabled for this workspace' })
  }

  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(event.method)
  const allowedReadOnlyPath = pathname.startsWith('/api/auth/') || pathname.startsWith('/api/export/')
  if (context.workspace?.lifecycleStatus === 'READ_ONLY' && !safeMethod && !allowedReadOnlyPath) {
    throw createError({ statusCode: 423, statusMessage: 'Workspace is read-only' })
  }
})
