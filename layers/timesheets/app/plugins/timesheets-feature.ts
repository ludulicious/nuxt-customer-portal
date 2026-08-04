import { timesheetsFeature } from '#layers/timesheets/shared/feature'

export default defineNuxtPlugin(() => {
  const portalFeatures = usePortalFeatures()
  const { activeOrganizationId } = usePortalSession()
  const primaryBadge = (count: number) => count
    ? {
        label: count,
        color: 'primary' as const,
        variant: 'solid' as const,
        square: true,
        class: 'size-5 justify-center rounded-full p-0'
      }
    : undefined
  const register = (capabilities: { canEnterTime: boolean, canInvoice: boolean, canViewSupplierTime: boolean, canAccessApprovals: boolean, canManageClientReviewers: boolean, canViewClientInvoices: boolean, canManageInvoiceViewers: boolean, pendingClientApprovalCount: number, unassignedClientReviewerSupplierCount: number }) => {
    const approvalActionCount = capabilities.pendingClientApprovalCount
      + (capabilities.canManageClientReviewers ? capabilities.unassignedClientReviewerSupplierCount : 0)
    const keep = (id: string) => id === 'client-invoices'
      ? capabilities.canViewClientInvoices
      : id === 'invoice-viewers'
      ? capabilities.canManageInvoiceViewers
      : id === 'timesheet-invoices'
      ? capabilities.canInvoice
      : ['client-approvals', 'timesheets-approvals'].includes(id)
      ? capabilities.canAccessApprovals
      : id === 'approval-reviewers'
      ? capabilities.canManageClientReviewers
      : ['supplier-timesheets', 'timesheets-suppliers'].includes(id)
      ? capabilities.canViewSupplierTime
      : capabilities.canEnterTime
    const canAccessTimesheets = capabilities.canEnterTime || capabilities.canViewSupplierTime || capabilities.canAccessApprovals
    const canAccessInvoices = capabilities.canInvoice || capabilities.canViewClientInvoices
    const timesheetsLandingTo = capabilities.canEnterTime ? '/timesheets' : capabilities.canAccessApprovals ? '/timesheets/approvals' : '/timesheets/suppliers'
    const invoicesLandingTo = capabilities.canViewClientInvoices ? '/timesheets/invoices' : '/admin/timesheets/invoices'
    portalFeatures.registerFeature({
      ...timesheetsFeature,
      navigation: timesheetsFeature.navigation?.filter(item => keep(item.id)).map(item => ({
        ...item,
        badge: item.id === 'timesheets-approvals' ? primaryBadge(approvalActionCount) : undefined
      })),
      modules: timesheetsFeature.modules?.filter(module => module.id === 'invoices' ? canAccessInvoices : canAccessTimesheets).map(module => ({
            ...module,
            to: module.id === 'invoices' ? invoicesLandingTo : timesheetsLandingTo,
            badge: module.id === 'timesheets' ? primaryBadge(approvalActionCount) : undefined,
            menuItems: module.menuItems?.filter(item => keep(item.id)).map(item => ({
              ...item,
              badge: item.id === 'client-approvals'
                ? primaryBadge(capabilities.pendingClientApprovalCount)
                : item.id === 'approval-reviewers'
                  ? primaryBadge(capabilities.unassignedClientReviewerSupplierCount)
                  : undefined
            }))
          })),
      dashboardWidgets: capabilities.canEnterTime ? timesheetsFeature.dashboardWidgets : []
    })
  }
  const empty = { canEnterTime: false, canInvoice: false, canViewSupplierTime: false, canAccessApprovals: false, canManageClientReviewers: false, canViewClientInvoices: false, canManageInvoiceViewers: false, pendingClientApprovalCount: 0, unassignedClientReviewerSupplierCount: 0 }
  register(empty)
  const refreshCapabilities = async () => {
    try {
      register(await $fetch('/api/timesheets/capabilities'))
    } catch {
      register(empty)
    }
  }
  if (import.meta.client) {
    window.addEventListener('timesheets:capabilities-refresh', refreshCapabilities)
  }
  watch(activeOrganizationId, async (organizationId) => {
    if (!organizationId) return register(empty)
    await refreshCapabilities()
  }, { immediate: true })
})
