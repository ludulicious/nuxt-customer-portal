import type {
  ServiceRequest,
  ServiceRequestCreateInput,
  ServiceRequestFilters,
  ServiceRequestListResponse,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestUpdateInput
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

export const useServiceRequests = () => {
  const { t } = useI18n()
  const requests = ref<ServiceRequest[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({ total: 0, page: 1, pageSize: 20, pageCount: 0 })

  const fetchRequests = async (filters: ServiceRequestFilters = {}) => {
    loading.value = true
    error.value = null
    try {
      const response = await $fetch<ServiceRequestListResponse>('/api/service-requests', { query: filters })
      requests.value = response.items
      pagination.value = response.pagination
      return response
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : t('features.serviceRequests.messages.fetchError')
      throw cause
    } finally {
      loading.value = false
    }
  }

  const createRequest = async (data: ServiceRequestCreateInput) => {
    loading.value = true
    try {
      const created = await $fetch<ServiceRequest>('/api/service-requests', { method: 'POST', body: data })
      requests.value.unshift(created)
      return created
    } finally {
      loading.value = false
    }
  }

  const updateRequest = async (id: string, data: ServiceRequestUpdateInput) => {
    loading.value = true
    try {
      const updated = await $fetch<ServiceRequest>(`/api/service-requests/${id}`, { method: 'PATCH', body: data })
      const index = requests.value.findIndex((request) => request.id === id)
      if (index >= 0) {
        requests.value[index] = updated
      }
      return updated
    } finally {
      loading.value = false
    }
  }

  const deleteRequest = async (id: string) => {
    await $fetch(`/api/service-requests/${id}`, { method: 'DELETE' as never })
    requests.value = requests.value.filter((request) => request.id !== id)
  }

  const getRequest = (id: string) => $fetch<ServiceRequest>(`/api/service-requests/${id}`)
  const getStatusBadgeText = (status: ServiceRequestStatus) =>
    t(`features.serviceRequests.status.${status.toLowerCase()}`)
  const getPriorityBadgeText = (priority: ServiceRequestPriority) =>
    t(`features.serviceRequests.priority.${priority.toLowerCase()}`)
  const getPriorityColor = (priority: ServiceRequestPriority) =>
    (
      ({
        LOW: 'success',
        MEDIUM: 'info',
        HIGH: 'warning',
        URGENT: 'error'
      }) as const
    )[priority]
  const getStatusColor = (status: ServiceRequestStatus) =>
    (
      ({
        OPEN: 'primary',
        IN_PROGRESS: 'warning',
        RESOLVED: 'success',
        CLOSED: 'neutral'
      }) as const
    )[status]

  const statusOptions = computed(() => [
    {
      label: t('features.serviceRequests.filters.allStatuses'),
      value: undefined,
      badgeText: '',
      badgeColor: 'neutral' as const
    },
    ...(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((value) => ({
      label: getStatusBadgeText(value),
      value,
      badgeText: getStatusBadgeText(value),
      badgeColor: getStatusColor(value)
    }))
  ])
  const priorityOptions = computed(() => [
    {
      label: t('features.serviceRequests.filters.allPriorities'),
      value: undefined,
      badgeText: '',
      badgeColor: 'neutral' as const
    },
    ...(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((value) => ({
      label: getPriorityBadgeText(value),
      value,
      badgeText: getPriorityBadgeText(value),
      badgeColor: getPriorityColor(value)
    }))
  ])

  return {
    requests: readonly(requests),
    loading: readonly(loading),
    error: readonly(error),
    pagination: readonly(pagination),
    fetchRequests,
    createRequest,
    updateRequest,
    deleteRequest,
    getRequest,
    getStatusColor,
    getPriorityBadgeText,
    getPriorityColor,
    getStatusBadgeText,
    statusOptions,
    priorityOptions
  }
}
