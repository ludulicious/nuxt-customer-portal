import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import type { InvoiceCapabilitiesDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'

export default defineNuxtPlugin(() => {
  const { registerFeature } = usePortalFeatures()
  const { activeOrganizationId } = usePortalSession()
  const register = (capabilities: InvoiceCapabilitiesDto) =>
    registerFeature({
      ...invoicesFeature,
      modules: invoicesFeature.modules
        ?.filter(() => capabilities.canConfigureInvoices || capabilities.canViewReceivedInvoices)
        .map((module) => ({
          ...module,
          to: capabilities.canViewReceivedInvoices ? '/invoices' : '/admin/invoices',
          menuItems: module.menuItems?.filter((item) =>
            item.id === 'invoice-settings'
              ? capabilities.canConfigureInvoices
              : item.id === 'sales-invoices'
                ? capabilities.canManageInvoices
                : item.id === 'invoice-viewers'
                  ? capabilities.canManageViewers
                  : capabilities.canViewReceivedInvoices
          )
        })),
      dashboardWidgets: invoicesFeature.dashboardWidgets?.filter((widget) =>
        widget.id === 'invoices-sales' ? capabilities.canManageInvoices : capabilities.canViewReceivedInvoices
      )
    })
  const empty = {
    canConfigureInvoices: false,
    canManageInvoices: false,
    canViewReceivedInvoices: false,
    canManageViewers: false,
    invoicesEnabled: false
  }
  register(empty)
  watch(
    activeOrganizationId,
    async (id) => {
      if (!id) {
        return register(empty)
      }
      try {
        register(await $fetch<InvoiceCapabilitiesDto>('/api/invoices/capabilities'))
      } catch {
        register(empty)
      }
    },
    { immediate: true }
  )
  if (import.meta.client) {
    window.addEventListener('invoices:capabilities-refresh', async () => {
      try {
        register(await $fetch<InvoiceCapabilitiesDto>('/api/invoices/capabilities'))
      } catch {
        register(empty)
      }
    })
  }
})
