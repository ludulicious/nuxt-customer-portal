export interface PortalSession {
  user: {
    id: string
    role?: string | null
  }
  session?: {
    activeOrganizationId?: string | null
  }
  activeOrganizationId?: string | null
}

export const getActiveOrganizationId = (session: PortalSession): string | null =>
  session.session?.activeOrganizationId ?? session.activeOrganizationId ?? null
