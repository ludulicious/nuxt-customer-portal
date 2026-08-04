import { serviceRequestFeature } from '#layers/service-requests/shared/feature'
import ServiceRequestsDashboardAttention from '../components/ServiceRequestsDashboardAttention.vue'
import ServiceRequestsDashboardOverview from '../components/ServiceRequestsDashboardOverview.vue'

export default defineNuxtPlugin(() => {
  const { registerFeature } = usePortalFeatures()
  const { activeOrganizationRole, isSystemAdmin } = usePortalSession()
  const register = () => {
    const canManage = isSystemAdmin.value || activeOrganizationRole.value === 'owner' || activeOrganizationRole.value === 'admin'
    registerFeature({
      ...serviceRequestFeature,
      dashboardWidgets: serviceRequestFeature.dashboardWidgets?.filter(widget => widget.id !== 'service-requests-attention' || canManage).map(widget => ({
        ...widget,
        component: widget.id === 'service-requests-attention'
          ? ServiceRequestsDashboardAttention
          : ServiceRequestsDashboardOverview
      }))
    })
  }
  watch([activeOrganizationRole, isSystemAdmin], register, { immediate: true })
})
