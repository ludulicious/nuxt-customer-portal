import { serviceRequestFeature } from '@nuxt-customer-portal/service-requests/shared/feature'

export default defineNuxtPlugin(() => {
  const { registerFeature } = usePortalFeatures()
  const { activeOrganizationRole, isSystemAdmin } = usePortalSession()
  const register = () => {
    const canManage = isSystemAdmin.value || activeOrganizationRole.value === 'owner' || activeOrganizationRole.value === 'admin'
    registerFeature({
      ...serviceRequestFeature,
      dashboardWidgets: serviceRequestFeature.dashboardWidgets?.filter(widget => widget.id !== 'service-requests-attention' || canManage)
    })
  }
  watch([activeOrganizationRole, isSystemAdmin], register, { immediate: true })
})
