import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import type { TimesheetCapabilitiesDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

export default defineNuxtPlugin(() => {
  const portalFeatures = usePortalFeatures()
  const { activeOrganizationId } = usePortalSession()
  const primaryBadge = (count: number) =>
    count
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
    const keep = (id: string) =>
      id === 'client-approvals'
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
    const canAccessTimesheets =
      capabilities.canEnterTime ||
      capabilities.canViewSupplierTime ||
      capabilities.canReviewClientTimesheets ||
      capabilities.canApproveInternalTimesheets ||
      capabilities.canManageTimesheets
    const timesheetsLandingTo = capabilities.canEnterTime
      ? '/timesheets'
      : capabilities.canReviewClientTimesheets
        ? '/timesheets/approvals'
        : capabilities.canApproveInternalTimesheets
          ? '/timesheets/internal-approvals'
          : capabilities.canViewSupplierTime
            ? '/timesheets/suppliers'
            : '/admin/timesheets/internal-approvals'
    portalFeatures.registerFeature({
      ...timesheetsFeature,
      navigation: timesheetsFeature.navigation
        ?.filter((item) => keep(item.id))
        .map((item) => ({
          ...item,
          badge:
            item.id === 'timesheets-approvals' ? primaryBadge(capabilities.pendingInternalApprovalCount) : undefined
        })),
      modules: timesheetsFeature.modules
        ?.filter(() => canAccessTimesheets)
        .map((module) => ({
          ...module,
          to: timesheetsLandingTo,
          badge: module.id === 'timesheets' ? primaryBadge(approvalActionCount) : undefined,
          menuItems: module.menuItems
            ?.filter((item) => keep(item.id))
            .map((item) => ({
              ...item,
              badge:
                item.id === 'client-approvals'
                  ? primaryBadge(capabilities.pendingClientApprovalCount)
                  : item.id === 'timesheet-approvals'
                    ? primaryBadge(capabilities.pendingInternalApprovalCount)
                    : item.id === 'approval-reviewers'
                      ? primaryBadge(capabilities.unassignedClientReviewerSupplierCount)
                      : undefined
            }))
        })),
      dashboardWidgets: timesheetsFeature.dashboardWidgets?.filter((widget) =>
        widget.id === 'timesheets-my-week'
          ? capabilities.canEnterTime
          : widget.id === 'timesheets-internal-approvals'
            ? capabilities.canApproveInternalTimesheets
            : widget.id === 'timesheets-client-approvals'
              ? capabilities.canReviewClientTimesheets
              : capabilities.canViewSupplierTime
      )
    })
  }
  const empty: TimesheetCapabilitiesDto = {
    canEnterTime: false,
    canApproveInternalTimesheets: false,
    hasInternalApprovalAssignments: false,
    canManageTimesheets: false,
    canReviewClientTimesheets: false,
    canViewSupplierTime: false,
    canAccessApprovals: false,
    canManageClientReviewers: false,
    pendingInternalApprovalCount: 0,
    pendingClientApprovalCount: 0,
    unassignedClientReviewerSupplierCount: 0
  }
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
  watch(
    activeOrganizationId,
    async (organizationId) => {
      if (!organizationId) {
        return register(empty)
      }
      await refreshCapabilities()
    },
    { immediate: true }
  )
})
