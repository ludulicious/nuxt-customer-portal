import type { NavigationMenuItem } from '@nuxt/ui'
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

export const useModuleNavigation = (sidebarOpen?: Ref<boolean>) => {
  const { t } = useI18n()
  const route = useRoute()
  const { modules: registeredModules } = usePortalFeatures()
  const { isAuthenticated, isSystemAdmin, activeOrganizationRole } = usePortalSession()

  const modules = computed(() => registeredModules.value
    .filter(module => hasAudience(module.audiences, isAuthenticated.value, isSystemAdmin.value, activeOrganizationRole.value))
    .map(module => ({ ...module, label: t(module.labelKey) })))

  const activeModule = computed(() => modules.value.find(module =>
    module.routePrefixes.some(prefix => route.path.startsWith(prefix))) ?? modules.value[0])

  const activeModuleId = computed(() => activeModule.value?.id ?? '')
  const activeModuleMenuItems = computed<NavigationMenuItem[]>(() => (activeModule.value?.menuItems ?? [])
    .filter(item => hasAudience(item.audiences, isAuthenticated.value, isSystemAdmin.value, activeOrganizationRole.value))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .map(item => ({
      label: t(item.labelKey),
      icon: item.icon,
      to: item.to,
      badge: item.badge,
      onSelect: () => {
        if (sidebarOpen) sidebarOpen.value = false
      }
    })))

  return { modules, activeModuleId, activeModule, activeModuleMenuItems }
}
