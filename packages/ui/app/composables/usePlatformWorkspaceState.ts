type WorkspaceCountResponse = {
  pagination?: { totalItems?: number }
}

export const usePlatformWorkspaceState = () => {
  const config = useRuntimeConfig()
  const requestUrl = useRequestURL()
  const platformHost = String(config.public.platformHost || 'platform.localhost').toLowerCase()
  const platformDomain = String(config.public.platformDomain || platformHost).toLowerCase()
  const isPlatformHost = computed(() => [platformHost, platformDomain].includes(requestUrl.hostname.toLowerCase()))
  const { data, pending, error } = useFetch<WorkspaceCountResponse>('/api/platform/workspaces', {
    key: 'platform-workspace-state',
    query: { page: 1, pageSize: 1 },
    immediate: isPlatformHost.value,
    default: () => ({ pagination: { totalItems: 1 } })
  })

  const hasWorkspace = computed(() => !isPlatformHost.value || Boolean(error.value) || (data.value?.pagination?.totalItems ?? 0) > 0)
  const hasNoWorkspace = computed(() => isPlatformHost.value && !pending.value && !error.value && (data.value?.pagination?.totalItems ?? 0) === 0)

  return { isPlatformHost, hasWorkspace, hasNoWorkspace, pending }
}
