import type { CommandPaletteGroup, CommandPaletteItem, NavigationMenuItem } from '@nuxt/ui'
import type { PortalAudience } from '@nuxt-customer-portal/core/shared/types/feature'

const hasAudience = (
  audiences: PortalAudience[],
  isAuthenticated: boolean,
  isAdmin: boolean,
  organizationRole: string | null,
  organizationType: 'PROVIDER' | 'CLIENT' | null
) =>
  audiences.some((audience) => {
    if (audience === 'public') {
      return true
    }
    if (audience === 'authenticated') {
      return isAuthenticated
    }
    if (audience === 'admin') {
      return isAdmin
    }
    if (audience === 'providerAuthenticated') {
      return organizationType === 'PROVIDER' && Boolean(organizationRole)
    }
    if (audience === 'providerAdmin') {
      return organizationType === 'PROVIDER' && (organizationRole === 'owner' || organizationRole === 'admin')
    }
    if (audience === 'clientAuthenticated') {
      return organizationType === 'CLIENT' && Boolean(organizationRole)
    }
    if (audience === 'clientAdmin') {
      return organizationType === 'CLIENT' && (organizationRole === 'owner' || organizationRole === 'admin')
    }
    return organizationType === 'PROVIDER' && (organizationRole === 'owner' || organizationRole === 'admin')
  })

export const useNavigationLinks = (sidebarOpen: Ref<boolean>) => {
  const { t } = useI18n()
  const route = useRoute()
  const { navigation } = usePortalFeatures()
  const { isAuthenticated, isSystemAdmin, activeOrganizationRole, activeOrganizationType } = usePortalSession()

  const visibleItems = computed(() =>
    navigation.value.filter(
      (item) =>
        hasAudience(
          item.audiences,
          isAuthenticated.value,
          isSystemAdmin.value,
          activeOrganizationRole.value,
          activeOrganizationType.value
        ) &&
        (route.path === '/' || !item.audiences.every((audience) => audience === 'public'))
    )
  )

  const links = computed<NavigationMenuItem[][]>(() => [
    visibleItems.value.map((item) => ({
      id: item.id,
      label: t(item.labelKey),
      icon: item.icon,
      to: item.to,
      badge: item.badge,
      onSelect: () => {
        sidebarOpen.value = false
      }
    }))
  ])

  const searchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => [
    {
      id: 'navigation',
      label: t('menu.search'),
      items: visibleItems.value.map((item) => ({
        id: item.id,
        label: t(item.labelKey),
        icon: item.icon,
        to: item.to
      }))
    }
  ])

  return { links, searchGroups }
}
