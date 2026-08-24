import type { ServiceRequestAction } from '@nuxt-customer-portal/service-requests/shared/feature'
import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'
import { isPortalActionAllowed } from '@nuxt-customer-portal/core/shared/feature-registry'
import type { PortalOrganizationRole } from '@nuxt-customer-portal/core/shared/types/feature'

export const useServiceRequestAccess = () => {
  const { activeOrganizationRole, activeOrganizationType } = usePortalSession()

  const can = (action: ServiceRequestAction) =>
    isPortalActionAllowed(
      serviceRequestFeature.policy,
      activeOrganizationRole.value as PortalOrganizationRole | null,
      action,
      activeOrganizationType.value ?? 'PROVIDER'
    )

  return { can }
}
