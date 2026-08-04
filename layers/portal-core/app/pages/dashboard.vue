<script setup lang="ts">
const { t } = useI18n()
const { dashboardWidgets } = usePortalFeatures()
const { currentUser } = usePortalSession()
const { isNotificationsSlideoverOpen } = useDashboard()

const areas = ['attention', 'main', 'aside'] as const
const widgetsByArea = computed(() => Object.fromEntries(areas.map(area => [
  area,
  dashboardWidgets.value.filter(widget => widget.area === area)
])))
const sizeClass = (size: 'full' | 'half' | 'third') => ({
  full: 'lg:col-span-12',
  half: 'lg:col-span-6',
  third: 'lg:col-span-4'
})[size]

useSeoMeta({ title: () => t('dashboard.seo.title'), description: () => t('dashboard.seo.description') })
</script>

<template>
  <UDashboardPanel id="dashboard" class="min-h-0 overflow-hidden" style="height: calc(100dvh - var(--ui-header-height));" :ui="{ body: 'flex flex-col flex-1 min-h-0 overflow-y-auto p-4 sm:p-6' }">
    <template #header>
      <UDashboardNavbar :ui="{ right: 'gap-3' }">
        <template #leading>
          <UIcon name="i-lucide-layout-dashboard" class="size-6 shrink-0" />
          <span class="text-lg font-semibold">{{ t('dashboard.title') }}</span>
        </template>
        <template #right>
          <UTooltip :text="t('dashboard.notifications')">
            <UButton color="neutral" variant="ghost" square icon="i-lucide-bell" :aria-label="t('dashboard.notifications')" @click="isNotificationsSlideoverOpen = true" />
          </UTooltip>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-[1440px] space-y-6">
        <header>
          <h1 class="text-2xl font-semibold tracking-tight">{{ t('dashboard.greeting', { name: currentUser?.name ?? '' }) }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('dashboard.introduction') }}</p>
        </header>

        <section v-for="area in areas" v-show="widgetsByArea[area]?.length" :key="area" :aria-label="t(`dashboard.areas.${area}`)">
          <h2 class="sr-only">{{ t(`dashboard.areas.${area}`) }}</h2>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div v-for="widget in widgetsByArea[area]" :key="widget.id" :class="sizeClass(widget.size)">
              <DashboardContribution :component="widget.component" />
            </div>
          </div>
        </section>

        <UCard v-if="!dashboardWidgets.length">
          <div class="py-8 text-center">
            <UIcon name="i-lucide-circle-check-big" class="mx-auto size-8 text-success" />
            <p class="mt-3 font-medium">{{ t('dashboard.empty.title') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('dashboard.empty.description') }}</p>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
