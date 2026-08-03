export const useServiceRequestMenu = () => {
  const { activeOrganizationRole } = usePortalSession()
  const { t } = useI18n()

  const isOrganizationAdmin = computed(() => {
    const role = activeOrganizationRole.value
    return role === 'owner' || role === 'admin'
  })

  const menuItems = computed(() => {
    const items = [
      {
        label: t('features.serviceRequests.navigation.myRequests'),
        to: '/requests',
        icon: 'i-lucide-ticket'
      }
    ]

    if (isOrganizationAdmin.value) {
      items.push({
        label: t('features.serviceRequests.navigation.manageRequests'),
        to: '/admin/requests',
        icon: 'i-lucide-settings'
      })
    }

    return items
  })

  return {
    menuItems: readonly(menuItems),
    isOrganizationAdmin: readonly(isOrganizationAdmin)
  }
}
