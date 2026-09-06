export const demoMessages = {
  en: 'This action is unavailable in the demo. No changes have been applied.',
  nl: 'Deze actie is niet beschikbaar in de demo. Er zijn geen wijzigingen toegepast.'
} as const

export function demoMessage(locale = '') {
  return demoMessages[locale.toLowerCase().startsWith('nl') ? 'nl' : 'en']
}

// Explicit allowlists keep newly introduced account endpoints closed in demos.
export function isDemoRequestAllowed(method: string, rawPath: string): boolean {
  let path: string
  try {
    path = decodeURIComponent(rawPath.split('?')[0]!).replace(/\/+$/, '')
  } catch {
    return false
  }
  if (path.includes('\\') || path.split('/').some((part) => part === '..' || part === '.')) {
    return false
  }
  const read = method === 'GET' || method === 'HEAD'
  if (path.startsWith('/api/auth/')) {
    const route = path.slice('/api/auth/'.length)
    if (read) {
      return [
        'get-session',
        'open-api/generate-schema',
        'permissions',
        'list-sessions',
        'list-accounts',
        'organization/list',
        'organization/get-full-organization',
        'organization/list-members',
        'organization/list-invitations',
        'organization/get-active-member',
        'organization/get-active-member-role',
        'organization/get-invitation',
        'admin/list-users',
        'admin/get-user',
        'admin/list-user-sessions'
      ].includes(route)
    }
    return (
      method === 'POST' &&
      ['organization/set-active', 'organization/has-permission', 'admin/has-permission'].includes(route)
    )
  }
  if (!path.startsWith('/api/')) {
    return true
  }
  if (read) {
    return true
  }
  if (path === '/api/demo/switch') {
    return method === 'POST'
  }
  if (
    /\/(members|invitations|reviewers|viewers|modules|internal-approvals|team|organization-capabilities|client-settings)(\/|$)/.test(
      path
    )
  ) {
    // Submitting an approval is business activity; configuring approvers changes access.
    return method === 'POST' && /^\/api\/timesheets\/internal-approvals\/[^/]+$/.test(path)
  }
  if (/^\/api\/(profile|auth|admin|organizations)(\/|$)/.test(path)) {
    return false
  }
  if (/^\/api\/timesheets\/admin\/(clients|settings)(\/|$)/.test(path) || path === '/api/invoices/admin/settings') {
    return false
  }
  if (/\/(email|email-status|reminder)(\/|$)/.test(path)) {
    return false
  }
  return /^\/api\/(clients|service-requests|timesheets|invoices|invoice-timesheets)(\/|$)/.test(path)
}
