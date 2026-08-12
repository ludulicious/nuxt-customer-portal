export interface PortalSession {
  user: {
    id: string
    name?: string | null
    email?: string
    role?: string | null
  }
  session?: {
    activeOrganizationId?: string | null
  }
  activeOrganizationId?: string | null
}

export type PortalOrganizationType = 'PROVIDER' | 'CLIENT'

export const getActiveOrganizationId = (session: PortalSession): string | null =>
  session.session?.activeOrganizationId ?? session.activeOrganizationId ?? null
