import type { ServiceRequestAction } from '@nuxt-customer-portal/service-requests/shared/feature'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'

export const useServiceRequestAccess = () => {
  const { activeOrganizationRole, isSystemAdmin } = usePortalSession()

  const can = (action: ServiceRequestAction) => {
    if (isSystemAdmin.value) return true
    const role = activeOrganizationRole.value
    if (role !== 'owner' && role !== 'admin' && role !== 'member') return false
    return serviceRequestFeature.policy[role].includes(action)
  }

  return { can }
}
