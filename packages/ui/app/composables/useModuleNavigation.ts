import type { NavigationMenuItem } from '@nuxt/ui'
import type { PortalAudience } from '@nuxt-customer-portal/core/shared/types/feature'

const hasAudience = (
  audiences: PortalAudience[],
  isAuthenticated: boolean,
  isAdmin: boolean,
  organizationRole: string | null,
  organizationType: 'PROVIDER' | 'CLIENT' | null
) => audiences.some((audience) => {
  if (audience === 'public') return true
  if (audience === 'authenticated') return isAuthenticated
  if (audience === 'admin') return isAdmin
  if (audience === 'providerAuthenticated') return organizationType === 'PROVIDER' && Boolean(organizationRole)
  if (audience === 'providerAdmin') return organizationType === 'PROVIDER' && (organizationRole === 'owner' || organizationRole === 'admin')
  if (audience === 'clientAuthenticated') return organizationType === 'CLIENT' && Boolean(organizationRole)
  if (audience === 'clientAdmin') return organizationType === 'CLIENT' && (organizationRole === 'owner' || organizationRole === 'admin')
  return organizationType === 'PROVIDER' && (organizationRole === 'owner' || organizationRole === 'admin')
})

export const useModuleNavigation = (sidebarOpen?: Ref<boolean>) => {
  const { t } = useI18n()
  const route = useRoute()
  const { modules: registeredModules } = usePortalFeatures()
  const { isAuthenticated, isSystemAdmin, activeOrganizationRole, activeOrganizationType } = usePortalSession()

  const modules = computed(() => registeredModules.value
    .filter(module => hasAudience(module.audiences, isAuthenticated.value, isSystemAdmin.value, activeOrganizationRole.value, activeOrganizationType.value))
    .map(module => ({ ...module, label: t(module.labelKey) })))

  const activeModule = computed(() => modules.value
    .map(module => ({ module, matchLength: Math.max(0, ...module.routePrefixes.filter(prefix => route.path.startsWith(prefix)).map(prefix => prefix.length)) }))
    .filter(item => item.matchLength > 0)
    .sort((left, right) => right.matchLength - left.matchLength)[0]?.module)

  const activeModuleId = computed(() => activeModule.value?.id ?? '')
  const moduleNavigationGroups = computed(() => modules.value.map(module => ({
    ...module,
    menuItems: (module.menuItems ?? [])
      .filter(item => hasAudience(item.audiences, isAuthenticated.value, isSystemAdmin.value, activeOrganizationRole.value, activeOrganizationType.value))
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
      .map(item => ({
        label: t(item.labelKey),
        icon: item.icon,
        to: item.to,
        exact: item.exact,
        badge: item.badge,
        onSelect: () => {
          if (sidebarOpen) sidebarOpen.value = false
        }
      }))
  })))
  const activeModuleMenuItems = computed<NavigationMenuItem[]>(() => (activeModule.value?.menuItems ?? [])
    .filter(item => hasAudience(item.audiences, isAuthenticated.value, isSystemAdmin.value, activeOrganizationRole.value, activeOrganizationType.value))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .map(item => ({
      label: t(item.labelKey),
      icon: item.icon,
      to: item.to,
      exact: item.exact,
      badge: item.badge,
      onSelect: () => {
        if (sidebarOpen) sidebarOpen.value = false
      }
    })))

  return { modules, moduleNavigationGroups, activeModuleId, activeModule, activeModuleMenuItems }
}
