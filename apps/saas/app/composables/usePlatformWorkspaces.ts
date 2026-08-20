export type PlatformWorkspace = {
  id: string
  organizationId: string | null
  slug: string
  lifecycleStatus: string
  canonicalDomain: string
  databaseMode: string
  selectedModules: string[]
  createdAt: string
}

export type PlatformWorkspaceListResponse = {
  items: PlatformWorkspace[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasPrevious: boolean
    hasNext: boolean
  }
}

export const usePlatformWorkspaces = () => {
  const requestFetch = useRequestFetch()

  return {
    list: (query: Record<string, string | number | undefined>) =>
      requestFetch<PlatformWorkspaceListResponse>('/api/platform/workspaces', { query }),
    transition: (workspaceId: string, status: string) =>
      requestFetch(`/api/platform/workspaces/${workspaceId}/lifecycle`, {
        method: 'PATCH',
        body: { status },
      }),
  }
}
