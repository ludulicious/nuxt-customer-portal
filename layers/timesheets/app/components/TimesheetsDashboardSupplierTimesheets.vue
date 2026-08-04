<script setup lang="ts">
const { t, locale } = useI18n()
const { data, pending, error, refresh } = await useTimesheetsDashboard()
const minutes = (amount: number) => `${Math.floor(amount / 60)}:${String(amount % 60).padStart(2, '0')}`
const date = (input: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${input}T00:00:00`))
</script>

<template>
  <UCard class="h-full">
    <template #header><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">{{ t('features.timesheets.dashboard.supplierTimesheets.title') }}</h2><UIcon name="i-lucide-building-2" class="size-5 text-primary" /></div></template>
    <div v-if="pending" class="space-y-3"><USkeleton class="h-8 w-24" /><USkeleton class="h-4 w-full" /></div>
    <div v-else-if="error" class="py-3 text-center"><p class="text-sm text-muted">{{ t('features.timesheets.dashboard.error') }}</p><UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" @click="refresh()">{{ t('features.timesheets.dashboard.retry') }}</UButton></div>
    <template v-else-if="data?.supplierTimesheets">
      <p v-if="!data.supplierTimesheets.items.length" class="py-4 text-sm text-muted">{{ t('features.timesheets.dashboard.supplierTimesheets.empty') }}</p>
      <ul v-else class="divide-y divide-default"><li v-for="item in data.supplierTimesheets.items" :key="item.id" class="flex items-center justify-between gap-3 py-3 text-sm"><span class="min-w-0"><strong class="block truncate">{{ item.person }}</strong><span class="text-muted">{{ item.supplierName }} · {{ date(item.weekStartsOn) }}</span></span><span class="shrink-0 text-right"><strong class="block tabular-nums">{{ minutes(item.totalMinutes) }}</strong><span class="text-xs text-muted">{{ t(`features.timesheets.dashboard.supplierTimesheets.${item.billingStatus.toLowerCase()}`) }}</span></span></li></ul>
      <div class="mt-3 text-right"><UButton to="/timesheets/suppliers" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right">{{ t('features.timesheets.dashboard.open') }}</UButton></div>
    </template>
  </UCard>
</template>
