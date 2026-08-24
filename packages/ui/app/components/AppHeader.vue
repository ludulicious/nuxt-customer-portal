<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'

const props = withDefaults(
  defineProps<{
    showNavigation?: boolean
    brandName?: string
    brandTagline?: string
  }>(),
  {
    showNavigation: true,
    brandName: 'Nuxt Customer Portal',
    brandTagline: 'Customer workspace'
  }
)

const { t, locale, setLocale } = useI18n()
const toast = useToast()
const portalRuntimeSettings = useState<{
  branding?: { portalName?: string; tagline?: string; markLight?: string; markDark?: string }
  appearance?: { colorMode?: string }
} | null>('portal-runtime-settings', () => null)
const colorMode = useColorMode()
const runtimeBrandName = computed(() => portalRuntimeSettings.value?.branding?.portalName || props.brandName)
const runtimeTagline = computed(() => portalRuntimeSettings.value?.branding?.tagline || props.brandTagline)
const runtimeMark = computed(() => {
  const branding = portalRuntimeSettings.value?.branding
  if (!branding) {
    return ''
  }
  return colorMode.value === 'dark'
    ? branding.markDark || branding.markLight || ''
    : branding.markLight || branding.markDark || ''
})
const showColorModeControl = computed(
  () => !portalRuntimeSettings.value || portalRuntimeSettings.value.appearance?.colorMode === 'user-choice'
)
// User store
const userStore = useUserStore()
const { currentUser, isAuthenticated, currentSession, myOrganizations, activeOrganization, loadingOrganization } =
  storeToRefs(userStore)

const showOrgSwitcherModal = ref(false)
const searchOpen = ref(false)
const headerMenuOpen = ref(false)

const hasMultipleOrganizations = computed(() => {
  return myOrganizations.value && myOrganizations.value.length > 1
})

// Dummy ref for sidebarOpen (not used in header, but required by composable)
const sidebarOpen = ref(false)

// Get navigation links for search groups
const { searchGroups } = useNavigationLinks(sidebarOpen)

const { modules, moduleNavigationGroups, activeModuleId, activeModule } = useModuleNavigation(headerMenuOpen)
const expandedMobileModuleId = ref('')

watch(
  activeModuleId,
  (moduleId) => {
    expandedMobileModuleId.value = moduleId
  },
  { immediate: true }
)

const toggleMobileModule = (moduleId: string) => {
  expandedMobileModuleId.value = expandedMobileModuleId.value === moduleId ? '' : moduleId
}

const moduleItems = computed(() => {
  return modules.value.map((module) => ({
    ...module,
    active: module.id === activeModuleId.value
  }))
})

const moduleBadgeProps = (badge: (typeof modules.value)[number]['badge']) =>
  typeof badge === 'object' ? badge : { label: badge }

// Create a reactive locale ref that's properly initialized
const currentLocale = ref(locale.value)

// Watch for locale changes and handle them properly
watch(
  locale,
  (newLocale) => {
    currentLocale.value = newLocale
    setLocale(newLocale)
    console.log('Locale changed to:', newLocale)
    // No URL change needed with no_prefix strategy
  },
  { immediate: false }
)

// Watch currentLocale changes to update the global locale
watch(currentLocale, (newLocale) => {
  setLocale(newLocale)
  // No URL change needed with no_prefix strategy
})

// Impersonation state
const isImpersonating = computed(() => !!currentSession.value?.impersonatedBy)

// Stop impersonating function
const stopImpersonating = async () => {
  try {
    await authClient.admin.stopImpersonating()
    toast.add({
      title: t('common.success'),
      description: t('admin.user.impersonate.stopSuccess'),
      color: 'success'
    })
    // Reload dashboard page
    window.location.href = '/dashboard'
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : t('admin.user.impersonate.stopError')
    toast.add({
      title: t('common.error'),
      description: errorMessage,
      color: 'error'
    })
  }
}
</script>

<template>
  <!-- Impersonation Banner -->
  <div v-if="isImpersonating" class="relative z-50 shrink-0">
    <UAlert
      color="warning"
      orientation="horizontal"
      :title="t('admin.user.impersonate.indicator')"
      :ui="{
        root: 'rounded-none bg-warning-50 px-4 py-2 dark:bg-warning-950',
        wrapper: 'flex-1',
        title: 'text-sm font-medium',
        actions: 'ml-auto'
      }"
      variant="outline"
    >
      <template #actions>
        <UButton color="warning" variant="solid" size="sm" @click="stopImpersonating">
          {{ t('admin.user.impersonate.stop') }}
        </UButton>
      </template>
    </UAlert>
  </div>

  <UHeader
    v-model:open="headerMenuOpen"
    class="portal-header"
    :title="activeModule?.label || t('menu.module')"
    mode="slideover"
    :menu="{ side: 'right' }"
    :ui="{
      root: 'relative top-auto',
      container: 'w-full max-w-none px-0',
      content: 'w-full max-w-sm',
      body: 'flex h-full flex-col overflow-y-auto p-0 sm:p-0'
    }"
  >
    <template #left>
      <div class="flex items-center gap-3">
        <!-- Logo Icon -->
        <NuxtLink to="/" class="shrink-0" :aria-label="runtimeBrandName">
          <div class="relative">
            <img v-if="runtimeMark" :src="runtimeMark" alt="" class="size-10 rounded-lg object-contain" />
            <svg
              v-else
              class="portal-logo-mark"
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <!-- Background circle -->
              <circle cx="20" cy="20" r="20" fill="var(--portal-logo-surface)" />
              <!-- Building/facility icon -->
              <rect x="12" y="15" width="4" height="10" fill="var(--portal-logo-ink)" rx="1" />
              <rect x="18" y="12" width="4" height="13" fill="var(--portal-logo-ink)" rx="1" />
              <rect x="24" y="18" width="4" height="7" fill="var(--portal-logo-ink)" rx="1" />
              <!-- Roof/peak -->
              <path d="M10 15 L20 8 L30 15 L28 15 L20 10 L12 15 Z" fill="var(--portal-logo-ink)" />
              <!-- Door -->
              <rect x="18" y="20" width="2" height="5" fill="var(--portal-logo-surface)" />
            </svg>
          </div>
        </NuxtLink>

        <!-- Neutral fallback wordmark; host shells can replace the layout entirely. -->
        <div class="hidden flex-col sm:flex">
          <span class="portal-wordmark text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {{ runtimeBrandName }}
          </span>
          <div class="-mt-1 flex items-center gap-1">
            <span class="text-sm leading-tight text-gray-600 dark:text-gray-400">
              {{ runtimeTagline }}
            </span>
            <UButton
              v-if="isAuthenticated && activeOrganization && hasMultipleOrganizations"
              :aria-label="t('menu.switchOrganization')"
              :title="t('menu.switchOrganization')"
              icon="i-lucide-arrow-left-right"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              class="hidden size-6 text-muted hover:text-highlighted lg:inline-flex"
              @click="showOrgSwitcherModal = true"
            />
          </div>
        </div>
      </div>
    </template>

    <nav v-if="showNavigation" class="hidden lg:flex flex-1 items-center justify-center gap-6">
      <template v-for="module in moduleItems" :key="module.id">
        <NuxtLink
          :to="module.to"
          :class="[
            'text-sm font-medium transition-colors flex items-center gap-1.5',
            module.active ? 'text-primary font-semibold' : 'text-muted hover:text-highlighted'
          ]"
        >
          <UIcon v-if="module.icon" :name="module.icon" class="w-4 h-4" />
          {{ module.label }}
          <UBadge v-if="module.badge" v-bind="moduleBadgeProps(module.badge)" />
        </NuxtLink>
      </template>
    </nav>

    <template #right>
      <div class="hidden lg:flex items-center gap-3 ml-auto">
        <UButton icon="i-lucide-search" color="neutral" variant="ghost" size="sm" square @click="searchOpen = true" />
        <ULocaleSelect
          v-model="currentLocale"
          :locales="[en, nl]"
          :ui="{ content: 'w-max min-w-40', itemLabel: 'whitespace-nowrap' }"
        />
        <UColorModeButton v-if="showColorModeControl" />

        <!-- User Avatar Dropdown (only show when user is logged in) -->
        <AppUserMenu size="sm" />
      </div>

      <!-- Organization Switcher Modal -->
      <UModal v-model:open="showOrgSwitcherModal" :title="t('menu.switchOrganization')" :ui="{ footer: 'justify-end' }">
        <template #body>
          <OrganizationSwitcher
            v-if="isAuthenticated"
            :show-create-button="false"
            @switched="showOrgSwitcherModal = false"
          />
        </template>
        <template #footer="{ close }">
          <UButton label="Close" color="neutral" variant="outline" @click="close" />
        </template>
      </UModal>
    </template>

    <template #body>
      <div class="border-b border-default px-4 py-2">
        <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          <UButton
            icon="i-lucide-search"
            :label="t('menu.search')"
            color="neutral"
            variant="outline"
            size="md"
            class="min-h-11 justify-start"
            @click="searchOpen = true"
          />
          <ULocaleSelect
            v-model="currentLocale"
            :locales="[en, nl]"
            class="w-32"
            :ui="{ content: 'w-max min-w-40', itemLabel: 'whitespace-nowrap' }"
          />
          <UColorModeButton v-if="showColorModeControl" size="md" class="min-h-11 min-w-11" />
        </div>
      </div>

      <nav v-if="showNavigation" :aria-label="t('menu.moduleNavigation')" class="space-y-5 p-5 pt-4">
        <section v-for="module in moduleNavigationGroups" :key="module.id" class="space-y-1">
          <button
            v-if="module.menuItems.length > 1"
            type="button"
            class="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-base font-bold text-highlighted transition-colors hover:bg-elevated"
            :class="module.id === activeModuleId ? 'bg-primary/10 text-primary' : ''"
            :aria-expanded="expandedMobileModuleId === module.id"
            :aria-controls="`mobile-module-${module.id}`"
            @click="toggleMobileModule(module.id)"
          >
            <UIcon v-if="module.icon" :name="module.icon" class="size-5 shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ module.label }}</span>
            <UBadge v-if="module.badge" v-bind="moduleBadgeProps(module.badge)" />
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 transition-transform"
              :class="expandedMobileModuleId === module.id ? 'rotate-180' : ''"
            />
          </button>
          <NuxtLink
            v-else
            :to="module.menuItems[0]?.to ?? module.to"
            class="flex min-h-11 items-center gap-3 rounded-md px-3 text-base font-bold text-highlighted transition-colors hover:bg-elevated"
            :class="module.id === activeModuleId ? 'bg-primary/10 text-primary' : ''"
            @click="headerMenuOpen = false"
          >
            <UIcon
              v-if="module.menuItems[0]?.icon ?? module.icon"
              :name="module.menuItems[0]?.icon ?? module.icon"
              class="size-5 shrink-0"
            />
            <span class="min-w-0 flex-1 truncate">{{ module.menuItems[0]?.label ?? module.label }}</span>
            <UBadge
              v-if="module.menuItems[0]?.badge ?? module.badge"
              v-bind="moduleBadgeProps(module.menuItems[0]?.badge ?? module.badge)"
            />
          </NuxtLink>
          <UNavigationMenu
            v-if="module.menuItems.length > 1 && expandedMobileModuleId === module.id"
            :id="`mobile-module-${module.id}`"
            :items="module.menuItems"
            orientation="vertical"
            class="w-full pl-5"
            :ui="{
              list: 'gap-1 border-l border-default pl-3',
              link: 'min-h-10 rounded-md px-3 text-sm font-medium'
            }"
          />
        </section>
      </nav>

      <div class="mt-auto border-t border-default p-4">
        <!-- Active Organization Display for Mobile -->
        <UButton
          v-if="isAuthenticated && loadingOrganization"
          variant="ghost"
          size="md"
          disabled
          block
          class="min-h-11 justify-start text-muted"
        >
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
        </UButton>
        <div v-else-if="isAuthenticated && activeOrganization" class="flex items-center gap-1">
          <UButton
            variant="ghost"
            size="md"
            icon="i-lucide-building-2"
            class="min-h-11 min-w-0 flex-1 justify-start text-muted hover:text-highlighted"
            @click="showOrgSwitcherModal = true"
          >
            <span class="truncate">{{ activeOrganization.name }}</span>
          </UButton>
          <UButton
            v-if="hasMultipleOrganizations"
            :aria-label="t('menu.switchOrganization')"
            :title="t('menu.switchOrganization')"
            icon="i-lucide-arrow-left-right"
            color="neutral"
            variant="ghost"
            size="md"
            square
            class="min-h-11 min-w-11 shrink-0 text-muted hover:text-highlighted"
            @click="showOrgSwitcherModal = true"
          />
        </div>

        <div v-if="currentUser" class="mt-2 border-t border-default pt-2">
          <AppUserMenu inline size="md" @navigate="headerMenuOpen = false" />
        </div>
      </div>
    </template>
  </UHeader>

  <!-- Dashboard Search Modal -->
  <UDashboardSearch
    v-model:open="searchOpen"
    :groups="searchGroups"
    :fuse="{
      fuseOptions: {
        ignoreLocation: true,
        threshold: 0.1,
        keys: ['label', 'suffix', '_searchText']
      }
    }"
  />
</template>
