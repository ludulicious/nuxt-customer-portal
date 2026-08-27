const alwaysAllowed = ['/api/health', '/api/portal/bootstrap', '/api/portal/public']
const moduleApiPrefixes: Record<string, string[]> = {
  timesheets: ['/api/timesheets'],
  invoices: ['/api/invoices'],
  'service-requests': ['/api/service-requests'],
  'invoice-timesheets': ['/api/invoice-timesheets'],
  'invoice-service-requests': ['/api/invoice-service-requests']
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) {
    return
  }
  if (alwaysAllowed.some((prefix) => path.startsWith(prefix))) {
    return
  }

  const state = await readPortalOnboardingState()
  if (path.startsWith('/api/auth/')) {
    if (!state.completed && path.includes('/sign-in/social')) {
      throw createError({
        statusCode: 403,
        message: 'Social authentication is unavailable until portal setup is complete'
      })
    }
    if (!state.completed && path.includes('/sign-up/')) {
      const body = await readBody(event)
      if (!isReservedPortalAdmin(body?.email)) {
        throw createError({
          statusCode: 403,
          message: 'Only the reserved portal administrator can create the first account'
        })
      }
    }
    return
  }

  if (!state.completed && !path.startsWith('/api/admin/portal-settings')) {
    throw createError({ statusCode: 503, message: 'Portal setup is not complete' })
  }

  if (state.completed) {
    const { settings } = await readPortalSettings()
    for (const [moduleId, prefixes] of Object.entries(moduleApiPrefixes)) {
      if (!settings.enabledModules.includes(moduleId as never) && prefixes.some((prefix) => path.startsWith(prefix))) {
        throw createError({ statusCode: 404, message: 'Module is not enabled' })
      }
    }
  }
})
