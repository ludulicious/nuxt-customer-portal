import { timesheetsFeature } from '#layers/timesheets/shared/feature'

export default defineNuxtPlugin(() => {
  const portalFeatures = usePortalFeatures()
  const { activeOrganizationId } = usePortalSession()
  const register = (capabilities: { canEnterTime: boolean, canInvoice: boolean, canViewClientTime: boolean }) => {
    const keep = (id: string) => id === 'timesheet-invoices'
      ? capabilities.canInvoice
      : ['client-timesheets', 'timesheets-client'].includes(id)
      ? capabilities.canViewClientTime
      : capabilities.canEnterTime
    portalFeatures.registerFeature({
      ...timesheetsFeature,
      navigation: timesheetsFeature.navigation?.filter(item => keep(item.id)),
      modules: capabilities.canEnterTime || capabilities.canViewClientTime
        ? timesheetsFeature.modules?.map(module => ({
            ...module,
            to: capabilities.canEnterTime ? module.to : '/timesheets/client',
            labelKey: capabilities.canEnterTime ? module.labelKey : 'features.timesheets.clientPortal.title',
            menuItems: module.menuItems?.filter(item => keep(item.id))
          }))
        : [],
      dashboardWidgets: capabilities.canEnterTime ? timesheetsFeature.dashboardWidgets : []
    })
  }
  register({ canEnterTime: false, canInvoice: false, canViewClientTime: false })
  watch(activeOrganizationId, async (organizationId) => {
    if (!organizationId) return register({ canEnterTime: false, canInvoice: false, canViewClientTime: false })
    try {
      register(await $fetch('/api/timesheets/capabilities'))
    } catch {
      register({ canEnterTime: false, canInvoice: false, canViewClientTime: false })
    }
  }, { immediate: true })
})
