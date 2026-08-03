export const useServiceRequestWidget = () => {
  const { requests, loading, fetchRequests } = useServiceRequests()
  const { activeOrganizationId } = usePortalSession()

  const initializeWidget = async () => {
    try {
      if (activeOrganizationId.value) await fetchRequests({ page: 1, pageSize: 5 })
    } catch (error) {
      console.error('Failed to check organization membership:', error)
    }
  }

  return {
    requests: readonly(requests),
    loading: readonly(loading),
    initializeWidget
  }
}
