import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import type { TimesheetCapabilitiesDto } from '#layers/timesheets/shared/types/timesheet'
import TimesheetsDashboardClientApprovals from '../components/TimesheetsDashboardClientApprovals.vue'
import TimesheetsDashboardInternalApprovals from '../components/TimesheetsDashboardInternalApprovals.vue'
import TimesheetsDashboardMyWeek from '../components/TimesheetsDashboardMyWeek.vue'
import TimesheetsDashboardReceivedInvoices from '../components/TimesheetsDashboardReceivedInvoices.vue'
import TimesheetsDashboardSalesInvoices from '../components/TimesheetsDashboardSalesInvoices.vue'
import TimesheetsDashboardSupplierTimesheets from '../components/TimesheetsDashboardSupplierTimesheets.vue'

export default defineNuxtPlugin(() => {
  const portalFeatures = usePortalFeatures()
  const { activeOrganizationId } = usePortalSession()
  const dashboardComponents = {
    'timesheets-my-week': TimesheetsDashboardMyWeek,
    'timesheets-internal-approvals': TimesheetsDashboardInternalApprovals,
    'timesheets-client-approvals': TimesheetsDashboardClientApprovals,
    'timesheets-supplier-timesheets': TimesheetsDashboardSupplierTimesheets,
    'timesheets-sales-invoices': TimesheetsDashboardSalesInvoices,
    'timesheets-received-invoices': TimesheetsDashboardReceivedInvoices
  }
  const primaryBadge = (count: number) => count
    ? {
        label: count,
        color: 'primary' as const,
        variant: 'solid' as const,
        square: true,
        class: 'size-5 justify-center rounded-full p-0'
      }
    : undefined
  const register = (capabilities: TimesheetCapabilitiesDto) => {
    const approvalActionCount = capabilities.pendingInternalApprovalCount + capabilities.pendingClientApprovalCount
      + (capabilities.canManageClientReviewers ? capabilities.unassignedClientReviewerSupplierCount : 0)
    const keep = (id: string) => id === 'client-invoices'
      ? capabilities.canViewClientInvoices
      : id === 'invoice-viewers'
      ? capabilities.canManageInvoiceViewers
      : id === 'timesheet-invoices'
      ? capabilities.canInvoice
      : id === 'client-approvals'
      ? capabilities.canReviewClientTimesheets
      : id === 'timesheets-approvals'
      ? capabilities.canApproveInternalTimesheets
      : id === 'timesheets-admin'
      ? capabilities.canManageTimesheets
      : id === 'internal-approval-settings'
      ? capabilities.canManageTimesheets
      : id === 'approval-reviewers'
      ? capabilities.canManageClientReviewers
      : ['supplier-timesheets', 'timesheets-suppliers'].includes(id)
      ? capabilities.canViewSupplierTime
      : capabilities.canEnterTime
    const canAccessTimesheets = capabilities.canEnterTime || capabilities.canViewSupplierTime || capabilities.canReviewClientTimesheets || capabilities.canApproveInternalTimesheets || capabilities.canManageTimesheets
    const canAccessInvoices = capabilities.canInvoice || capabilities.canViewClientInvoices
    const timesheetsLandingTo = capabilities.canEnterTime
      ? '/timesheets'
      : capabilities.canReviewClientTimesheets
        ? '/timesheets/approvals'
        : capabilities.canApproveInternalTimesheets
          ? '/timesheets/internal-approvals'
          : capabilities.canViewSupplierTime
            ? '/timesheets/suppliers'
            : '/admin/timesheets/internal-approvals'
    const invoicesLandingTo = capabilities.canViewClientInvoices ? '/timesheets/invoices' : '/admin/timesheets/invoices'
    portalFeatures.registerFeature({
      ...timesheetsFeature,
      navigation: timesheetsFeature.navigation?.filter(item => keep(item.id)).map(item => ({
        ...item,
        badge: item.id === 'timesheets-approvals' ? primaryBadge(capabilities.pendingInternalApprovalCount) : undefined
      })),
      modules: timesheetsFeature.modules?.filter(module => module.id === 'invoices' ? canAccessInvoices : canAccessTimesheets).map(module => ({
            ...module,
            to: module.id === 'invoices' ? invoicesLandingTo : timesheetsLandingTo,
            badge: module.id === 'timesheets' ? primaryBadge(approvalActionCount) : undefined,
            menuItems: module.menuItems?.filter(item => keep(item.id)).map(item => ({
              ...item,
              badge: item.id === 'client-approvals'
                ? primaryBadge(capabilities.pendingClientApprovalCount)
                : item.id === 'timesheet-approvals'
                  ? primaryBadge(capabilities.pendingInternalApprovalCount)
                : item.id === 'approval-reviewers'
                  ? primaryBadge(capabilities.unassignedClientReviewerSupplierCount)
                  : undefined
            }))
          })),
      dashboardWidgets: timesheetsFeature.dashboardWidgets?.filter(widget => widget.id === 'timesheets-my-week'
        ? capabilities.canEnterTime
        : widget.id === 'timesheets-internal-approvals'
          ? capabilities.canApproveInternalTimesheets
          : widget.id === 'timesheets-client-approvals'
            ? capabilities.canReviewClientTimesheets
            : widget.id === 'timesheets-supplier-timesheets'
              ? capabilities.canViewSupplierTime
            : widget.id === 'timesheets-sales-invoices'
              ? capabilities.canInvoice
              : capabilities.canViewClientInvoices).map(widget => ({
                ...widget,
                component: dashboardComponents[widget.id as keyof typeof dashboardComponents]
              }))
    })
  }
  const empty: TimesheetCapabilitiesDto = { canEnterTime: false, canApproveInternalTimesheets: false, hasInternalApprovalAssignments: false, canManageTimesheets: false, canReviewClientTimesheets: false, canInvoice: false, canViewSupplierTime: false, canAccessApprovals: false, canManageClientReviewers: false, canViewClientInvoices: false, canManageInvoiceViewers: false, pendingInternalApprovalCount: 0, pendingClientApprovalCount: 0, unassignedClientReviewerSupplierCount: 0 }
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
