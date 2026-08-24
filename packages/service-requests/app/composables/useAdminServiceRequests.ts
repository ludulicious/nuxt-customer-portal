import type {
  AdminServiceRequestUpdateInput,
  ServiceRequest,
  ServiceRequestFilters,
  ServiceRequestListResponse
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

export const useAdminServiceRequests = () => {
  const requests = ref<ServiceRequest[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({ total: 0, page: 1, pageSize: 20, pageCount: 0 })
  const stats = computed(() =>
    requests.value.reduce<Record<string, number>>((result, request) => {
      result[request.status] = (result[request.status] ?? 0) + 1
      return result
    }, {})
  )

  const fetchAllRequests = async (filters: ServiceRequestFilters = {}) => {
    loading.value = true
    error.value = null
    try {
      const response = await $fetch<ServiceRequestListResponse>('/api/service-requests/admin', { query: filters })
      requests.value = response.items
      pagination.value = response.pagination
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to fetch service requests'
      throw cause
    } finally {
      loading.value = false
    }
  }

  const adminUpdateRequest = async (id: string, data: AdminServiceRequestUpdateInput) => {
    const updated = await $fetch<ServiceRequest>(`/api/service-requests/admin/${id}`, {
      method: 'PATCH',
      body: data
    })
    const index = requests.value.findIndex((request) => request.id === id)
    if (index >= 0) {
      requests.value[index] = updated
    }
    return updated
  }

  return {
    requests: readonly(requests),
    loading: readonly(loading),
    error: readonly(error),
    pagination: readonly(pagination),
    stats,
    fetchAllRequests,
    adminUpdateRequest,
    assignRequest: (id: string, userId: string) => adminUpdateRequest(id, { assignedToId: userId }),
    resolveRequest: (id: string) => adminUpdateRequest(id, { status: 'RESOLVED' }),
    closeRequest: (id: string) => adminUpdateRequest(id, { status: 'CLOSED' }),
    reopenRequest: (id: string) => adminUpdateRequest(id, { status: 'OPEN' })
  }
}
