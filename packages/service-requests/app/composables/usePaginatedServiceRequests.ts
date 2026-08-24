import type {
  ServiceRequest,
  ServiceRequestFilters,
  ServiceRequestListResponse
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'
import { usePaginatedResource } from '@nuxt-customer-portal/core/app/composables/usePaginatedResource'

export const usePaginatedServiceRequests = (pageSize = 20) =>
  usePaginatedResource<ServiceRequest, ServiceRequestFilters>({
    pageSize,
    getKey: (request) => request.id,
    fetchPage: ({ filters, page, pageSize, signal }) =>
      $fetch<ServiceRequestListResponse>('/api/service-requests', {
        query: {
          ...filters,
          page,
          pageSize
        },
        signal
      })
  })
