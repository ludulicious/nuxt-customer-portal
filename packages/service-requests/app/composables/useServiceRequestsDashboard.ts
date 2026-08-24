import type { ServiceRequestDashboardDto } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

export const useServiceRequestsDashboard = () => {
  const { activeOrganizationId } = usePortalSession()
  return useAsyncData(
    'service-requests-dashboard',
    () => $fetch<ServiceRequestDashboardDto>('/api/service-requests/dashboard'),
    {
      watch: [activeOrganizationId],
      dedupe: 'defer'
    }
  )
}
