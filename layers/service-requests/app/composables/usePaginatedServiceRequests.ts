import type {
  ServiceRequest,
  ServiceRequestFilters,
  ServiceRequestListResponse
} from '#layers/service-requests/shared/types/service-request'
import { usePaginatedResource } from '#portal/app/composables/usePaginatedResource'

export const usePaginatedServiceRequests = (pageSize = 20) =>
  usePaginatedResource<ServiceRequest, ServiceRequestFilters>({
    pageSize,
    getKey: request => request.id,
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
