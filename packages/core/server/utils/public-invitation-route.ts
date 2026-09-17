export const isPublicInvitationRoute = (method: string, pathname: string) =>
  (method === 'GET' && pathname === '/api/organizations/get-invitation') ||
  (method === 'POST' && pathname === '/api/organizations/invitation-signup')
