export function isPublicStoreRoute(method: string, pathname: string) {
  return (
    (method === 'GET' &&
      (/^\/api\/store\/v1\/products(?:\/[^/]+)?$/.test(pathname) ||
        /^\/api\/store\/(product|media)\/[^/]+$/.test(pathname) ||
        /^\/api\/store\/planning\/[^/]+\/availability$/.test(pathname) ||
        pathname === '/api/store/planning/hold' ||
        /^\/api\/store\/sandbox-checkout\/[^/]+$/.test(pathname))) ||
    (method === 'POST' &&
      (['/api/store/checkout', '/api/store/webhooks/stripe', '/api/store/planning/holds'].includes(pathname) ||
        /^\/api\/store\/sandbox-checkout\/[^/]+$/.test(pathname))) ||
    (method === 'DELETE' && pathname === '/api/store/planning/hold')
  )
}
