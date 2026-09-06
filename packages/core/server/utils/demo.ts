import { createError, getCookie, getHeader, type H3Event } from 'h3'
import { demoMessage } from '../../shared/demo-policy'

export const isPortalDemo = () => useRuntimeConfig().portalDemo?.enabled === true
export function rejectDemoAction(event?: H3Event): never {
  const message = demoMessage(event ? getCookie(event, 'i18n_redirected') || getHeader(event, 'accept-language') : '')
  throw createError({
    statusCode: 403,
    statusMessage: 'Demo action unavailable',
    message,
    data: { code: 'DEMO_RESTRICTED', message }
  })
}
