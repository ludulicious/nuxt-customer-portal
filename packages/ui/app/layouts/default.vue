<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const open = ref(false)
const showFooter = computed(() => route.meta?.public === true)

const { links } = useNavigationLinks(open)
const { activeModule, activeModuleMenuItems } = useModuleNavigation(open)
const { isPlatformHost, hasWorkspace } = usePlatformWorkspaceState()
const showAppNavigation = computed(() => !isPlatformHost.value || hasWorkspace.value)
const { currentSession } = storeToRefs(useUserStore())
const isImpersonating = computed(() => Boolean(currentSession.value?.impersonatedBy))

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.value.flat().map(item => ({
    label: item.label,
    icon: item.icon,
    to: item.to
  }))
}])

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
</script>

<template>
  <div class="dashboard-layout relative min-h-screen">
    <!-- AppHeader - fixed at top -->
    <div class="fixed top-0 left-0 right-0 z-50">
      <div class="mx-auto w-full max-w-[1600px] px-4">
        <AppHeader :show-navigation="showAppNavigation" />
      </div>
    </div>

    <UDashboardGroup
      unit="rem"
      class="px-4 mx-auto max-w-[1600px]! w-full!"
    >
      <UDashboardSidebar
        v-if="showAppNavigation"
        id="default"
        v-model:open="open"
        collapsible
        resizable
        :default-size="18"
        :min-size="18"
        :max-size="24"
        class="min-w-72 bg-elevated/25 lg:pb-12 data-[collapsed=true]:min-w-0"
        :ui="{ footer: 'lg:border-t lg:border-default' }"
      >
        <template #header>
          <div v-if="activeModule" class="flex min-w-0 items-center gap-2 px-2 text-sm font-semibold">
            <UIcon v-if="activeModule.icon" :name="activeModule.icon" class="size-4 shrink-0 text-primary" />
            <span class="truncate">{{ activeModule.label }}</span>
          </div>
        </template>
        <template #default="{ collapsed }">
          <UDashboardSearchButton :collapsed="collapsed" class="mt-2 bg-transparent ring-default" />
          <div v-if="!collapsed && activeModule" class="px-2.5 pt-3 pb-1 text-xs font-semibold uppercase text-muted">
            {{ activeModule.label }}
          </div>
          <UNavigationMenu :collapsed="collapsed" :items="activeModuleMenuItems" orientation="vertical" tooltip popover />
        </template>
      </UDashboardSidebar>

      <UDashboardSearch
        :groups="groups"
        :fuse="{
          fuseOptions: {
            ignoreLocation: true,
            threshold: 0.1,
            keys: ['label', 'suffix', '_searchText']
          }
        }"
      />

      <NotificationsSlideover />
      <UMain class="flex-1 min-w-0" :class="isImpersonating ? 'pt-32 lg:pt-28' : 'pt-20 lg:pt-16'">
        <slot />
      </UMain>
    </UDashboardGroup>

    <AppFooter v-if="showFooter" />
  </div>
</template>
