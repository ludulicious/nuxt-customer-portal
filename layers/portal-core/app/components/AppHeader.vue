<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'
import { authClient } from '#portal/app/utils/auth-client'

withDefaults(defineProps<{
  showNavigation?: boolean
}>(), {
  showNavigation: true
})

const { t, locale, setLocale } = useI18n()
const toast = useToast()
// User store
const userStore = useUserStore()
const { currentUser, isAuthenticated, currentSession, myOrganizations, activeOrganization, loadingOrganization } = storeToRefs(userStore)

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

const { modules, activeModuleId, activeModule, activeModuleMenuItems } = useModuleNavigation()

const moduleItems = computed(() => {
  return modules.value.map(module => ({
    ...module,
    active: module.id === activeModuleId.value
  }))
})

const moduleSwitchItems = computed(() => [
  modules.value.map(module => ({
    label: module.label,
    icon: module.icon,
    badge: module.badge,
    to: module.to
  }))
])

const moduleBadgeProps = (badge: NonNullable<(typeof modules.value)[number]['badge']>) =>
  typeof badge === 'object' ? badge : { label: badge }

// Create a reactive locale ref that's properly initialized
const currentLocale = ref(locale.value)

// Watch for locale changes and handle them properly
watch(locale, (newLocale) => {
  currentLocale.value = newLocale
  setLocale(newLocale)
  console.log('Locale changed to:', newLocale)
  // No URL change needed with no_prefix strategy
}, { immediate: false })

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
      }" variant="outline" >
      <template #actions>
        <UButton
          color="warning"
          variant="solid"
          size="sm"
          @click="stopImpersonating"
        >
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
        <NuxtLink to="/" class="shrink-0" aria-label="ApexPro">
          <div class="relative">
            <svg class="portal-logo-mark" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

        <!-- ApexPro Title with Organization Name or Facility Services Subtitle -->
        <div class="hidden flex-col sm:flex">
          <span class="portal-wordmark text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            ApexPro
          </span>
          <div
            v-if="isAuthenticated && activeOrganization && hasMultipleOrganizations"
            class="-mt-1 flex items-center gap-1"
          >
            <button
              type="button"
              class="text-left text-sm leading-tight text-gray-600 transition-colors hover:text-highlighted dark:text-gray-400"
              @click="showOrgSwitcherModal = true"
            >
              {{ activeOrganization.name }}
            </button>
            <UButton
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
          <span
            v-else-if="isAuthenticated && activeOrganization"
            class="text-sm text-gray-600 dark:text-gray-400 leading-tight -mt-1"
          >
            {{ activeOrganization.name }}
          </span>
          <span
            v-else-if="isAuthenticated && loadingOrganization"
            class="text-sm text-gray-400 leading-tight -mt-1 flex items-center gap-1"
          >
            <UIcon name="i-lucide-loader-2" class="w-3 h-3 animate-spin" />
            Loading...
          </span>
          <span v-else class="text-sm text-gray-600 dark:text-gray-400 leading-tight -mt-1">
            Facility Services
          </span>
        </div>
      </div>
    </template>

    <nav v-if="showNavigation" class="hidden lg:flex flex-1 items-center justify-center gap-6">
      <template v-for="module in moduleItems" :key="module.id">
        <NuxtLink :to="module.to" :class="[
          'text-sm font-medium transition-colors flex items-center gap-1.5',
          module.active
            ? 'text-primary font-semibold'
            : 'text-muted hover:text-highlighted'
        ]">
          <UIcon v-if="module.icon" :name="module.icon" class="w-4 h-4" />
          {{ module.label }}
          <UBadge v-if="module.badge" v-bind="moduleBadgeProps(module.badge)" />
        </NuxtLink>
      </template>
    </nav>

    <template #right>
      <UDropdownMenu
        v-if="showNavigation && activeModule && !headerMenuOpen"
        class="min-w-0 lg:hidden"
        :items="moduleSwitchItems"
        :content="{ align: 'end', collisionPadding: 12 }"
      >
        <UButton
          :label="activeModule.label"
          :icon="activeModule.icon"
          trailing-icon="i-lucide-chevrons-up-down"
          color="neutral"
          variant="ghost"
          size="md"
          class="min-h-11 max-w-56 justify-center px-2 font-semibold [&>span]:truncate"
          :aria-label="t('menu.selectModule')"
        />
      </UDropdownMenu>

      <div class="hidden lg:flex items-center gap-3 ml-auto">
        <UButton
          icon="i-lucide-search"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          @click="searchOpen = true"
        />
        <ULocaleSelect v-model="currentLocale" :locales="[en, nl]" />
        <UColorModeButton />

        <!-- User Avatar Dropdown (only show when user is logged in) -->
        <AppUserMenu size="sm" />
      </div>

      <!-- Organization Switcher Modal -->
      <UModal v-model:open="showOrgSwitcherModal" :title="t('menu.switchOrganization')" :ui="{ footer: 'justify-end' }">
        <template #body>
          <OrganizationSwitcher v-if="isAuthenticated" :show-create-button="false" @switched="showOrgSwitcherModal = false" />
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
          <ULocaleSelect v-model="currentLocale" :locales="[en, nl]" class="w-32" />
          <UColorModeButton size="md" class="min-h-11 min-w-11" />
        </div>
      </div>

      <nav v-if="showNavigation && activeModule" :aria-label="t('menu.activeModuleNavigation')" class="p-5 pt-4">
        <div class="flex min-w-0 items-center gap-3 pb-5">
          <span class="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <UIcon v-if="activeModule.icon" :name="activeModule.icon" class="size-5" />
          </span>
          <div class="min-w-0">
            <div class="truncate text-base font-bold text-highlighted">
              {{ activeModule.label }}
            </div>
            <div class="text-sm text-muted">
              {{ t('menu.moduleMenuDescription') }}
            </div>
          </div>
        </div>
        <UNavigationMenu
          :items="activeModuleMenuItems"
          orientation="vertical"
          class="w-full"
          :ui="{
            list: 'gap-1',
            link: 'min-h-11 rounded-md px-3 text-base font-medium'
          }"
        />
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
        <UButton
          v-else-if="isAuthenticated && activeOrganization"
          variant="ghost"
          size="md"
          icon="i-lucide-building-2"
          block
          class="min-h-11 justify-start text-muted hover:text-highlighted"
          @click="showOrgSwitcherModal = true"
        >
          {{ activeOrganization.name }}
        </UButton>

        <div v-if="currentUser" class="mt-2">
          <AppUserMenu />
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
