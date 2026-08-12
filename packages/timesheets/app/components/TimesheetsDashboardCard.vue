<script setup lang="ts">
const props = defineProps<{ section: 'myWeek' | 'internalApprovals' | 'clientApprovals' | 'salesInvoices' | 'receivedInvoices' }>()
const { t, locale } = useI18n()
const { data, pending, error, refresh } = await useTimesheetsDashboard()
interface DashboardCardValue {
  weekStartsOn: string
  status: string
  totalMinutes: number
  rejectionComment: string | null
  hasRunningTimer: boolean
  pendingCount: number
  unassignedSupplierCount: number
  items: Array<{ id: string, userName: string, weekStartsOn: string, totalMinutes: number, person: string, supplierName: string, status: string }>
  currency: string | null
  draftCount: number
  issuedCount: number
  overdueCount: number
  outstandingMinor: number
  recent: Array<{ id: string, number: string, supplierName: string, recipientName: string, status: string, currency: string, outstandingMinor: number, isOverdue: boolean }>
}
const value = computed(() => data.value?.[props.section] as unknown as DashboardCardValue | undefined)
const minutes = (amount: number) => `${Math.floor(amount / 60)}:${String(amount % 60).padStart(2, '0')}`
const money = (amount: number, currency: string | null | undefined) => currency
  ? new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(amount / 100)
  : new Intl.NumberFormat(locale.value).format(amount / 100)
const date = (input: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${input}T00:00:00`))
const title = computed(() => t(`features.timesheets.dashboard.${props.section}.title`))
const icon = computed(() => ({ myWeek: 'i-lucide-clock-3', internalApprovals: 'i-lucide-stamp', clientApprovals: 'i-lucide-building-2', salesInvoices: 'i-lucide-send', receivedInvoices: 'i-lucide-inbox' })[props.section])
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ title }}</h2>
        <UIcon :name="icon" class="size-5 text-primary" />
      </div>
    </template>

    <div v-if="pending" class="space-y-3" aria-live="polite">
      <USkeleton class="h-8 w-24" /><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-2/3" />
    </div>
    <div v-else-if="error" class="py-3 text-center">
      <p class="text-sm text-muted">{{ t('features.timesheets.dashboard.error') }}</p>
      <UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" @click="refresh()">{{ t('features.timesheets.dashboard.retry') }}</UButton>
    </div>
    <div v-else-if="!value" class="py-4 text-center text-sm text-muted">{{ t('features.timesheets.dashboard.unavailable') }}</div>

    <template v-else-if="section === 'myWeek'">
      <div class="flex items-end justify-between gap-4">
        <div><p class="text-3xl font-semibold tabular-nums">{{ minutes(value.totalMinutes) }}</p><p class="mt-1 text-sm text-muted">{{ date(value.weekStartsOn) }} · {{ t(`features.timesheets.status.${value.status.toLowerCase()}`) }}</p></div>
        <UButton to="/timesheets" variant="outline" trailing-icon="i-lucide-arrow-right">{{ t('features.timesheets.dashboard.open') }}</UButton>
      </div>
      <UAlert v-if="value.rejectionComment" class="mt-4" color="error" variant="subtle" icon="i-lucide-message-circle-warning" :title="t('features.timesheets.dashboard.myWeek.rejected')" :description="value.rejectionComment" />
      <p v-else-if="value.hasRunningTimer" class="mt-4 text-sm text-primary">{{ t('features.timesheets.dashboard.myWeek.timerRunning') }}</p>
    </template>

    <template v-else-if="section === 'internalApprovals'">
      <div class="flex items-center justify-between"><p class="text-3xl font-semibold tabular-nums">{{ value.pendingCount }}</p><UButton to="/timesheets/internal-approvals" variant="outline">{{ t('features.timesheets.dashboard.review') }}</UButton></div>
      <p v-if="!value.items.length" class="mt-4 text-sm text-muted">{{ t('features.timesheets.dashboard.internalApprovals.empty') }}</p>
      <ul v-else class="mt-4 divide-y divide-default"><li v-for="item in value.items" :key="item.id" class="flex items-center justify-between gap-3 py-2 text-sm"><span class="truncate"><strong>{{ item.userName }}</strong><span class="block text-muted">{{ date(item.weekStartsOn) }}</span></span><span class="shrink-0 text-right"><strong class="block tabular-nums">{{ minutes(item.totalMinutes) }}</strong><span class="text-xs text-muted">{{ t(`features.timesheets.status.${item.status.toLowerCase()}`) }}</span></span></li></ul>
    </template>

    <template v-else-if="section === 'clientApprovals'">
      <div class="flex items-center justify-between"><p class="text-3xl font-semibold tabular-nums">{{ value.pendingCount }}</p><UButton to="/timesheets/approvals" variant="outline">{{ t('features.timesheets.dashboard.review') }}</UButton></div>
      <UAlert v-if="value.unassignedSupplierCount" class="mt-4" color="warning" variant="subtle" icon="i-lucide-user-round-x" :description="t('features.timesheets.dashboard.clientApprovals.noReviewer')" />
      <p v-if="!value.items.length" class="mt-4 text-sm text-muted">{{ t('features.timesheets.dashboard.clientApprovals.empty') }}</p>
      <ul v-else class="mt-4 divide-y divide-default"><li v-for="item in value.items" :key="item.id" class="flex justify-between gap-3 py-2 text-sm"><span class="truncate"><strong>{{ item.person }}</strong><span class="block text-muted">{{ item.supplierName }}</span></span><span class="shrink-0 text-muted">{{ minutes(item.totalMinutes) }}</span></li></ul>
    </template>

    <template v-else-if="section === 'salesInvoices'">
      <div class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-3xl font-semibold tabular-nums">{{ money(value.outstandingMinor, value.currency) }}</p><p class="text-sm text-muted">{{ t('features.timesheets.dashboard.outstanding') }}</p></div><UButton to="/admin/timesheets/invoices" variant="outline">{{ t('features.timesheets.dashboard.manage') }}</UButton></div>
      <div class="mt-4 flex flex-wrap gap-2"><UBadge color="neutral" variant="subtle">{{ t('features.timesheets.dashboard.salesInvoices.drafts', value.draftCount) }}</UBadge><UBadge color="primary" variant="subtle">{{ t('features.timesheets.dashboard.salesInvoices.issued', { count: value.issuedCount }) }}</UBadge><UBadge v-if="value.overdueCount" color="error" variant="subtle">{{ t('features.timesheets.dashboard.overdue', { count: value.overdueCount }) }}</UBadge></div>
      <p v-if="!value.recent.length" class="mt-4 text-sm text-muted">{{ t('features.timesheets.dashboard.salesInvoices.empty') }}</p>
      <ul v-else class="mt-4 divide-y divide-default"><li v-for="item in value.recent.slice(0, 3)" :key="item.id" class="flex justify-between gap-3 py-2 text-sm"><span class="truncate font-medium">{{ item.recipientName }} · {{ item.number }}</span><span :class="item.isOverdue ? 'text-error' : 'text-muted'">{{ money(item.outstandingMinor, value.currency) }}</span></li></ul>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-3xl font-semibold tabular-nums">{{ money(value.outstandingMinor, value.currency) }}</p><p class="text-sm text-muted">{{ t('features.timesheets.dashboard.outstanding') }}</p></div><UButton to="/timesheets/invoices" variant="outline">{{ t('features.timesheets.dashboard.open') }}</UButton></div>
      <UBadge v-if="value.overdueCount" class="mt-4" color="error" variant="subtle">{{ t('features.timesheets.dashboard.overdue', { count: value.overdueCount }) }}</UBadge>
      <p v-if="!value.recent.length" class="mt-4 text-sm text-muted">{{ t('features.timesheets.dashboard.receivedInvoices.empty') }}</p>
      <ul v-else class="mt-4 divide-y divide-default"><li v-for="item in value.recent.slice(0, 3)" :key="item.id" class="flex justify-between gap-3 py-2 text-sm"><span class="truncate font-medium">{{ item.supplierName }} · {{ item.number }}</span><span :class="item.isOverdue ? 'text-error' : 'text-muted'">{{ money(item.outstandingMinor, item.currency) }}</span></li></ul>
    </template>
  </UCard>
</template>
