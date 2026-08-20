export const useTimesheetMenu = () => {
  const { activeOrganizationRole, isSystemAdmin } = usePortalSession()
  const { t } = useI18n()
  const route = useRoute()

  const isOrganizationAdmin = computed(() => {
    const role = activeOrganizationRole.value
    return isSystemAdmin.value || role === 'owner' || role === 'admin'
  })

  const menuItems = computed(() => {
    const items = [
      {
        label: t('features.timesheets.navigation.myTimesheet'),
        to: '/timesheets',
        icon: 'i-lucide-clock-3',
        active: route.path === '/timesheets'
      }
    ]

    if (isOrganizationAdmin.value) {
      items.push(
        {
          label: t('features.timesheets.internalApprovals.manageTitle'),
          to: '/admin/timesheets/internal-approvals',
          icon: 'i-lucide-user-round-check',
          active: route.path === '/admin/timesheets/internal-approvals'
        },
        {
          label: t('features.timesheets.admin.projects'),
          to: '/admin/timesheets/projects',
          icon: 'i-lucide-folder-kanban',
          active: route.path === '/admin/timesheets/projects'
        },
        {
          label: t('features.timesheets.admin.activities'),
          to: '/admin/timesheets/activities',
          icon: 'i-lucide-tags',
          active: route.path === '/admin/timesheets/activities'
        },
        {
          label: t('features.timesheets.admin.teamRates'),
          to: '/admin/timesheets/rates',
          icon: 'i-lucide-badge-euro',
          active: route.path === '/admin/timesheets/rates'
        },
        {
          label: t('features.timesheets.admin.workspaceSettings'),
          to: '/admin/timesheets/settings',
          icon: 'i-lucide-settings-2',
          active: route.path === '/admin/timesheets/settings'
        },
        {
          label: t('features.timesheets.admin.reports'),
          to: '/admin/timesheets/reports',
          icon: 'i-lucide-chart-no-axes-combined',
          active: route.path === '/admin/timesheets/reports'
        }
      )
    }

    return items
  })

  return {
    menuItems: readonly(menuItems),
    isOrganizationAdmin: readonly(isOrganizationAdmin)
  }
}
