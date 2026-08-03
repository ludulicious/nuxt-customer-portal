import type { NavigationMenuItem } from '@nuxt/ui'

type ModuleRole = 'public' | 'authenticated' | 'admin'

interface ModuleConfig {
  id: 'dashboard' | 'service-requests' | 'timesheets' | 'admin'
  labelKey: string
  icon?: string
  to: string
  roles?: ModuleRole[]
  routePrefixes: string[]
}

interface ModuleMenuItemConfig {
  labelKey?: string
  label?: string
  icon?: string
  to: string
  roles?: ModuleRole[]
}

const hasRequiredRole = (roles: ModuleRole[] | undefined, isAuthenticated: boolean, isAdmin: boolean): boolean => {
  if (!roles || roles.length === 0) return true
  if (roles.includes('public')) return true
  if (roles.includes('authenticated') && isAuthenticated) return true
  if (roles.includes('admin') && isAdmin) return true
  return false
}

const applySidebarClose = (items: readonly NavigationMenuItem[], sidebarOpen?: Ref<boolean>) => {
  if (!sidebarOpen) return [...items]
  return items.map(item => ({
    ...item,
    onSelect: () => {
      sidebarOpen.value = false
    }
  }))
}

export const useModuleNavigation = (sidebarOpen?: Ref<boolean>) => {
  const { t } = useI18n()
  const route = useRoute()
  const userStore = useUserStore()
  const { isAdmin, isAuthenticated } = storeToRefs(userStore)
  const { menuItems: serviceRequestMenuItems } = useServiceRequestMenu()
  const { menuItems: timesheetMenuItems } = useTimesheetMenu()

  const moduleConfigs: ModuleConfig[] = [
    {
      id: 'dashboard',
      labelKey: 'menu.dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard',
      roles: ['public', 'authenticated'],
      routePrefixes: ['/dashboard']
    },
    {
      id: 'service-requests',
      labelKey: 'features.serviceRequests.navigation.myRequests',
      icon: 'i-lucide-ticket',
      to: '/requests',
      roles: ['authenticated'],
      routePrefixes: ['/requests', '/admin/requests']
    },
    {
      id: 'timesheets',
      labelKey: 'features.timesheets.navigation.myTimesheet',
      icon: 'i-lucide-clock-3',
      to: '/timesheets',
      roles: ['authenticated'],
      routePrefixes: ['/timesheets', '/admin/timesheets']
    },
    {
      id: 'admin',
      labelKey: 'nav.admin',
      icon: 'i-lucide-shield-check',
      to: '/admin/organizations',
      roles: ['admin'],
      routePrefixes: ['/admin']
    }
  ]

  const modules = computed(() => {
    return moduleConfigs
      .filter(module => hasRequiredRole(module.roles, isAuthenticated.value, isAdmin.value))
      .map(module => ({
        id: module.id,
        label: t(module.labelKey),
        icon: module.icon,
        to: module.to
      }))
  })

  const activeModuleId = computed<ModuleConfig['id']>(() => {
    const path = route.path
    const matched = moduleConfigs.find(module => module.routePrefixes.some(prefix => path.startsWith(prefix)))
    return matched?.id || 'dashboard'
  })

  const adminMenuConfig: ModuleMenuItemConfig[] = [
    {
      labelKey: 'admin.menu.organizations',
      icon: 'i-lucide-building-2',
      to: '/admin/organizations',
      roles: ['admin']
    },
    {
      labelKey: 'admin.menu.users',
      icon: 'i-lucide-users',
      to: '/admin/users',
      roles: ['admin']
    }
  ]

  const dashboardMenuConfig: ModuleMenuItemConfig[] = [
    {
      labelKey: 'menu.dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard',
      roles: ['public', 'authenticated']
    }
  ]

  const buildMenuItems = (items: ModuleMenuItemConfig[]): NavigationMenuItem[] => {
    return items
      .filter(item => hasRequiredRole(item.roles, isAuthenticated.value, isAdmin.value))
      .map(item => ({
        label: item.labelKey ? t(item.labelKey) : item.label || '',
        icon: item.icon,
        to: item.to
      }))
  }

  const activeModuleMenuItems = computed<NavigationMenuItem[]>(() => {
    const id = activeModuleId.value
    if (id === 'service-requests') {
      return applySidebarClose(serviceRequestMenuItems.value, sidebarOpen)
    }

    if (id === 'timesheets') {
      return applySidebarClose(timesheetMenuItems.value, sidebarOpen)
    }

    if (id === 'admin') {
      return applySidebarClose(buildMenuItems(adminMenuConfig), sidebarOpen)
    }

    return applySidebarClose(buildMenuItems(dashboardMenuConfig), sidebarOpen)
  })

  const activeModule = computed(() => modules.value.find(module => module.id === activeModuleId.value) || modules.value[0])

  return {
    modules,
    activeModuleId,
    activeModule,
    activeModuleMenuItems
  }
}
