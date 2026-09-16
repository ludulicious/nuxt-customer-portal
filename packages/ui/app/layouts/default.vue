<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const { t } = useI18n()
const open = ref(false)
const sidebarCollapsed = ref(false)
const showFooter = computed(() => route.meta?.public === true)

const { activeModule, activeModuleMenuItems } = useModuleNavigation(open)
const { currentSession } = storeToRefs(useUserStore())
const isImpersonating = computed(() => Boolean(currentSession.value?.impersonatedBy))

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [
      {
        label: 'Accept',
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          cookie.value = 'accepted'
        }
      },
      {
        label: 'Opt out',
        color: 'neutral',
        variant: 'ghost'
      }
    ]
  })
})
</script>

<template>
  <div class="dashboard-layout relative min-h-screen" :data-sidebar-collapsed="sidebarCollapsed">
    <!-- AppHeader - fixed at top -->
    <div class="fixed left-0 right-0 z-50" style="top: var(--portal-top-bar-height, 0px)">
      <div class="mx-auto w-full max-w-[1600px] px-4">
        <AppHeader />
      </div>
    </div>

    <UDashboardGroup
      unit="rem"
      storage-key="portal-dashboard-v2"
      class="px-4 mx-auto max-w-[1600px]! w-full!"
      style="top: var(--portal-top-bar-height, 0px)"
    >
      <UDashboardSidebar
        id="default"
        v-model:open="open"
        v-model:collapsed="sidebarCollapsed"
        collapsible
        resizable
        :collapsed-size="4"
        :default-size="18"
        :min-size="18"
        :max-size="24"
        class="min-w-72 bg-elevated/25 lg:pb-12 data-[collapsed=true]:min-w-16"
        :ui="{ footer: 'lg:border-t lg:border-default' }"
      >
        <template #header="{ collapsed }">
          <div v-if="activeModule && !collapsed" class="flex min-w-0 items-center gap-2 px-2 text-sm font-semibold">
            <UIcon v-if="activeModule.icon" :name="activeModule.icon" class="size-4 shrink-0 text-primary" />
            <span class="truncate">{{ activeModule.label }}</span>
          </div>
        </template>
        <template #default="{ collapsed, collapse }">
          <div class="flex items-center pt-3 pb-1" :class="collapsed ? 'justify-center' : 'justify-between px-2.5'">
            <span v-if="!collapsed && activeModule" class="text-xs font-semibold uppercase text-muted">
              {{ activeModule.label }}
            </span>
            <UButton
              :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="t(collapsed ? 'common.expandSidebar' : 'common.collapseSidebar')"
              :title="t(collapsed ? 'common.expandSidebar' : 'common.collapseSidebar')"
              @click="collapse(!collapsed)"
            />
          </div>
          <UNavigationMenu
            :collapsed="collapsed"
            :items="activeModuleMenuItems"
            orientation="vertical"
            tooltip
            popover
          />
        </template>
      </UDashboardSidebar>

      <NotificationsSlideover />
      <UMain class="flex-1 min-h-0 min-w-0" :class="isImpersonating ? 'pt-32 lg:pt-28' : 'pt-20 lg:pt-16'">
        <slot />
      </UMain>
    </UDashboardGroup>

    <AppFooter v-if="showFooter" />
  </div>
</template>

<style>
.dashboard-layout[data-sidebar-collapsed='true'] main [class~='max-w-(--ui-container)'] {
  max-width: none;
}
</style>
