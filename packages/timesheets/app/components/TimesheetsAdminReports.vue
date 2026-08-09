<script setup lang="ts">
/* eslint-disable @stylistic/max-statements-per-line */
import type { TimesheetStatus } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'
import type { TimesheetsAdminBootstrap } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'

const props = defineProps<{
  data: TimesheetsAdminBootstrap
  refresh?: () => Promise<unknown>
}>()
const { t } = useI18n()
const timesheets = useTimesheets()
const allFilterValue = '__all__'
const filters = reactive({ from: '', to: '', clientOrganizationId: allFilterValue, projectId: allFilterValue, userId: '', activityTypeId: '', status: '' as '' | TimesheetStatus })
const report = ref<Awaited<ReturnType<typeof timesheets.getReport>> | null>(null)
const query = () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== allFilterValue))
const loadReport = async () => { report.value = await timesheets.getReport(query()) }
const downloadCsv = () => {
  const params = new URLSearchParams(query())
  params.set('format', 'csv')
  window.location.assign(`/api/timesheets/admin/report?${params}`)
}
const formatHours = (minutes: number) => `${(minutes / 60).toFixed(2)} h`
const formatMoney = (minor: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: props.data.settings.currency }).format(minor / 100)
</script>

<template>
  <section class="space-y-5">
    <UCard>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UFormField :label="t('features.timesheets.admin.from')"><UInput v-model="filters.from" type="date" class="w-full" /></UFormField>
        <UFormField :label="t('features.timesheets.admin.to')"><UInput v-model="filters.to" type="date" class="w-full" /></UFormField>
        <UFormField :label="t('features.timesheets.admin.client')"><USelect v-model="filters.clientOrganizationId" :items="[{ label: t('features.timesheets.admin.all'), value: allFilterValue }, ...data.clients.map(item => ({ label: item.name, value: item.organizationId }))]" value-key="value" class="w-full" /></UFormField>
        <UFormField :label="t('features.timesheets.fields.project')"><USelect v-model="filters.projectId" :items="[{ label: t('features.timesheets.admin.all'), value: allFilterValue }, ...data.projects.map(item => ({ label: item.name, value: item.id }))]" value-key="value" class="w-full" /></UFormField>
      </div>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-download" @click="downloadCsv">{{ t('features.timesheets.admin.exportCsv') }}</UButton>
        <UButton icon="i-lucide-search" @click="loadReport">{{ t('features.timesheets.admin.runReport') }}</UButton>
      </div>
    </UCard>
    <div v-if="report" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <UCard><p class="text-sm text-muted">{{ t('features.timesheets.admin.totalHours') }}</p><p class="mt-1 text-2xl font-semibold">{{ formatHours(report.totals.minutes) }}</p></UCard>
      <UCard><p class="text-sm text-muted">{{ t('features.timesheets.admin.billableHours') }}</p><p class="mt-1 text-2xl font-semibold">{{ formatHours(report.totals.billableMinutes) }}</p></UCard>
      <UCard><p class="text-sm text-muted">{{ t('features.timesheets.admin.nonBillableHours') }}</p><p class="mt-1 text-2xl font-semibold">{{ formatHours(report.totals.nonBillableMinutes) }}</p></UCard>
      <UCard><p class="text-sm text-muted">{{ t('features.timesheets.admin.billableAmount') }}</p><p class="mt-1 text-2xl font-semibold">{{ formatMoney(report.totals.billableAmountMinor) }}</p></UCard>
    </div>
    <UCard v-if="report" :ui="{ body: '!p-0' }">
      <div class="overflow-x-auto">
<table class="w-full min-w-[52rem] text-sm">
        <thead class="border-b border-default bg-muted text-left text-muted"><tr><th class="p-3">{{ t('features.timesheets.fields.date') }}</th><th class="p-3">{{ t('features.timesheets.admin.client') }}</th><th class="p-3">{{ t('features.timesheets.fields.project') }}</th><th class="p-3">{{ t('features.timesheets.admin.person') }}</th><th class="p-3">{{ t('features.timesheets.fields.activity') }}</th><th class="p-3 text-right">{{ t('features.timesheets.admin.hours') }}</th><th class="p-3 text-right">{{ t('features.timesheets.admin.amount') }}</th></tr></thead>
        <tbody><tr v-for="row in report.rows" :key="row.entryId" class="border-b border-muted"><td class="p-3">{{ row.date }}</td><td class="p-3">{{ row.client }}</td><td class="p-3">{{ row.project }}</td><td class="p-3">{{ row.person }}</td><td class="p-3">{{ row.activity }}</td><td class="p-3 text-right tabular-nums">{{ formatHours(row.minutes) }}</td><td class="p-3 text-right tabular-nums">{{ formatMoney(row.amountMinor) }}</td></tr></tbody>
      </table>
</div>
    </UCard>
  </section>
</template>
