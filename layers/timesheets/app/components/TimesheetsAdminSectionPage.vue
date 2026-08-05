<script setup lang="ts">
import type { Component } from 'vue'
import TimesheetsAdminActivities from './TimesheetsAdminActivities.vue'
import TimesheetsAdminApprovals from './TimesheetsAdminApprovals.vue'
import TimesheetsAdminClients from './TimesheetsAdminClients.vue'
import TimesheetsAdminProjects from './TimesheetsAdminProjects.vue'
import TimesheetsAdminRates from './TimesheetsAdminRates.vue'
import TimesheetsAdminReports from './TimesheetsAdminReports.vue'
import TimesheetsAdminInvoices from './TimesheetsAdminInvoices.vue'
import TimesheetsAdminSettings from './TimesheetsAdminSettings.vue'

type AdminSection = 'approvals' | 'clients' | 'projects' | 'activities' | 'rates' | 'settings' | 'reports' | 'invoices'
type CrudSectionView = {
  canCreate: boolean
  openCreate: () => void
  refreshList: () => Promise<unknown>
  showCreate: boolean
}

const props = defineProps<{ section: AdminSection }>()
const sectionComponents = {
  approvals: TimesheetsAdminApprovals,
  clients: TimesheetsAdminClients,
  projects: TimesheetsAdminProjects,
  activities: TimesheetsAdminActivities,
  rates: TimesheetsAdminRates,
  settings: TimesheetsAdminSettings,
  reports: TimesheetsAdminReports,
  invoices: TimesheetsAdminInvoices
} satisfies Record<AdminSection, Component>
const sectionTitleKeys = {
  approvals: 'approvals',
  clients: 'clients',
  projects: 'projects',
  activities: 'activities',
  rates: 'teamRates',
  settings: 'workspaceSettings',
  reports: 'reports',
  invoices: 'invoices'
} satisfies Record<AdminSection, string>
const sectionIcons: Partial<Record<AdminSection, string>> = {
  clients: 'i-lucide-building-2', projects: 'i-lucide-folder-kanban', activities: 'i-lucide-tags', invoices: 'i-lucide-file-text'
}
const createLabelKeys: Partial<Record<AdminSection, string>> = {
  clients: 'newClient', projects: 'newProject', activities: 'newActivity', invoices: 'newInvoice'
}
const { t } = useI18n()
const timesheets = useTimesheets()
const sectionViewRef = ref<CrudSectionView | null>(null)
const refreshing = ref(false)
const sectionComponent = computed(() => sectionComponents[props.section])
const titleKey = computed(() => sectionTitleKeys[props.section])
const sectionTitle = computed(() => t(`features.timesheets.admin.${titleKey.value}`))
const sectionSubtitle = computed(() => t(`features.timesheets.admin.sectionSubtitles.${props.section}`))
const hasConstrainedList = computed(() => ['clients', 'projects', 'activities', 'invoices'].includes(props.section))
const createLabel = computed(() => createLabelKeys[props.section] ? t(`features.timesheets.admin.${createLabelKeys[props.section]}`) : '')
const { data, pending, refresh } = await useAsyncData(
  `timesheets-admin-${props.section}`,
  () => timesheets.adminBootstrap(props.section)
)
const openCreate = () => sectionViewRef.value?.openCreate()
const refreshSection = async () => {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([refresh(), sectionViewRef.value?.refreshList()])
  } finally {
    refreshing.value = false
  }
}

useSeoMeta({ title: sectionTitle })
</script>

<template>
  <TimesheetsPageShell class="timesheet-admin h-full min-h-0" :class="hasConstrainedList ? 'flex flex-col overflow-hidden' : 'space-y-6 overflow-y-auto'">
    <header :class="hasConstrainedList ? 'mb-6 shrink-0' : ''">
      <div class="flex items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2"><UIcon v-if="sectionIcons[section]" :name="sectionIcons[section]" class="size-6 shrink-0" /><h1 class="text-2xl font-semibold text-highlighted">{{ sectionTitle }}</h1></div>
          <p class="mt-1 text-sm text-muted">{{ sectionSubtitle }}</p>
        </div>
        <div v-if="hasConstrainedList" class="flex shrink-0 items-center gap-1">
          <UButton v-if="sectionViewRef?.showCreate" icon="i-lucide-plus" size="sm" variant="outline" class="h-8" :disabled="!sectionViewRef.canCreate" @click="openCreate">
            <span class="hidden sm:inline">{{ createLabel }}</span>
          </UButton>
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="sm" :loading="refreshing" :aria-label="t('features.timesheets.admin.refresh')" @click="refreshSection" />
        </div>
      </div>
    </header>
    <div v-if="pending && !data" class="flex justify-center py-12 text-muted" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
      <span class="sr-only">{{ t('features.timesheets.loading') }}</span>
    </div>
    <component
      :is="sectionComponent"
      v-if="data"
      ref="sectionViewRef"
      :key="props.section"
      :data="data"
      :refresh="refresh"
      :class="hasConstrainedList ? 'min-h-0 flex-1' : ''"
    />
  </TimesheetsPageShell>
</template>
