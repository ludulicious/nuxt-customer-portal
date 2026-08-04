<!-- Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 -->
<script setup lang="ts">
const { t, locale } = useI18n()
const api = useTimesheets()
const capabilities = await $fetch<{ canAccessApprovals: boolean, canEnterTime: boolean, canViewSupplierTime: boolean }>('/api/timesheets/capabilities')
if (!capabilities.canViewSupplierTime) {
  await navigateTo(capabilities.canEnterTime ? '/timesheets' : capabilities.canAccessApprovals ? '/timesheets/approvals' : '/dashboard', { replace: true })
}
const selectedId = ref('')
const { data: allWorkspaces } = await useAsyncData('supplier-timesheet-workspaces', api.clientWorkspaces)
const workspaces = computed(() => allWorkspaces.value?.filter(item => item.accessMode === 'VIEW') ?? [])
watchEffect(() => {
  if (!selectedId.value && workspaces.value.length) selectedId.value = workspaces.value[0]!.id
})
const { data } = await useAsyncData('supplier-timesheet-data', async () => selectedId.value ? api.clientTimesheets(selectedId.value) : null, { watch: [selectedId] })
const hours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
const formatDate = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
const weekEnd = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + 6)
  return formatDate(date.toISOString().slice(0, 10))
}
const billingKey = (value: string) => ({ AWAITING_INVOICE: 'awaitingInvoice', PARTIALLY_INVOICED: 'partiallyInvoiced', INVOICED: 'invoiced' })[value] ?? 'awaitingInvoice'
useSeoMeta({ title: () => t('features.timesheets.suppliers.title') })
</script>

<template>
  <div class="mx-auto h-full max-w-6xl overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
    <header class="border-b border-default pb-5"><h1 class="text-2xl font-semibold">{{ t('features.timesheets.suppliers.title') }}</h1><p class="mt-1 text-sm text-muted">{{ t('features.timesheets.suppliers.subtitle') }}</p></header>
    <UAlert v-if="!workspaces.length" class="mt-6" icon="i-lucide-building-2" :title="t('features.timesheets.suppliers.noAccess')" variant="outline" />
    <template v-else><div class="py-5"><UFormField :label="t('features.timesheets.clientPortal.supplier')"><USelect v-model="selectedId" :items="workspaces.map(item => ({ label: item.workspaceName, value: item.id }))" value-key="value" class="w-full sm:max-w-sm" /></UFormField></div><div class="space-y-4"><article v-for="slice in data?.slices" :key="slice.weeklyTimesheetId" class="overflow-hidden rounded-lg border border-default bg-default"><header class="flex flex-wrap items-start justify-between gap-3 border-b border-default p-5"><div><h2 class="font-semibold">{{ formatDate(slice.weekStartsOn) }} – {{ weekEnd(slice.weekStartsOn) }}</h2><p class="mt-1 text-sm text-muted">{{ slice.person }}</p></div><UBadge :color="slice.billingStatus === 'INVOICED' ? 'success' : 'neutral'" variant="subtle">{{ t(`features.timesheets.clientBilling.${billingKey(slice.billingStatus)}`) }}</UBadge></header><div class="divide-y divide-default px-5"><div v-for="entry in slice.entries" :key="entry.id" class="grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_5rem]"><span class="text-sm text-muted">{{ formatDate(entry.date) }}</span><div><p class="text-sm font-medium">{{ entry.project }} · {{ entry.activity }}</p><p v-if="entry.note" class="mt-1 text-sm text-muted">{{ entry.note }}</p></div><strong class="text-sm sm:text-right">{{ hours(entry.minutes) }}</strong></div></div></article></div></template>
  </div>
</template>
