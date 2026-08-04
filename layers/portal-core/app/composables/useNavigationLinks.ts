import type { CommandPaletteGroup, CommandPaletteItem, NavigationMenuItem } from '@nuxt/ui'
import type { PortalAudience } from '#portal/shared/types/feature'

const hasAudience = (
  audiences: PortalAudience[],
  isAuthenticated: boolean,
  isAdmin: boolean,
  organizationRole: string | null
) => audiences.some((audience) => {
  if (audience === 'public') return true
  if (audience === 'authenticated') return isAuthenticated
  if (audience === 'admin') return isAdmin
  return organizationRole === 'owner' || organizationRole === 'admin' || isAdmin
})

export const useNavigationLinks = (sidebarOpen: Ref<boolean>) => {
  const { t } = useI18n()
  const route = useRoute()
  const { navigation } = usePortalFeatures()
  const { isAuthenticated, isSystemAdmin, activeOrganizationRole } = usePortalSession()

  const visibleItems = computed(() => navigation.value.filter(item =>
    hasAudience(item.audiences, isAuthenticated.value, isSystemAdmin.value, activeOrganizationRole.value)
    && (route.path === '/' || !item.audiences.every(audience => audience === 'public'))))

  const links = computed<NavigationMenuItem[][]>(() => [visibleItems.value.map(item => ({
    id: item.id,
    label: t(item.labelKey),
    icon: item.icon,
    to: item.to,
    badge: item.badge,
    onSelect: () => { sidebarOpen.value = false }
  }))])

  const searchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => [{
    id: 'navigation',
    label: t('menu.search'),
    items: visibleItems.value.map(item => ({
      id: item.id,
      label: t(item.labelKey),
      icon: item.icon,
      to: item.to
    }))
  }])

  return { links, searchGroups }
}
