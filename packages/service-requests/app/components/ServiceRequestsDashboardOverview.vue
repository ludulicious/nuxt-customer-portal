<script setup lang="ts">
const { t, locale } = useI18n()
const { data, pending, error, refresh } = await useServiceRequestsDashboard()
const formatDate = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
</script>

<template>
  <UCard class="h-full">
    <template #header><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">{{ t('features.serviceRequests.dashboard.overview.title') }}</h2><UButton to="/requests/new" size="sm" icon="i-lucide-plus">{{ t('features.serviceRequests.dashboard.new') }}</UButton></div></template>
    <div v-if="pending" class="space-y-3"><USkeleton class="h-8 w-24" /><USkeleton class="h-4 w-full" /></div>
    <div v-else-if="error" class="py-3 text-center"><p class="text-sm text-muted">{{ t('features.serviceRequests.dashboard.error') }}</p><UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" @click="refresh()">{{ t('features.serviceRequests.dashboard.retry') }}</UButton></div>
    <template v-else-if="data">
      <div class="flex flex-wrap gap-3"><UBadge color="primary" variant="subtle">{{ t('features.serviceRequests.dashboard.active', { count: data.overview.activeCount }) }}</UBadge><UBadge color="success" variant="subtle">{{ t('features.serviceRequests.dashboard.resolved', { count: data.overview.resolvedCount }) }}</UBadge></div>
      <p v-if="!data.overview.recent.length" class="py-6 text-center text-sm text-muted">{{ t('features.serviceRequests.dashboard.overview.empty') }}</p>
      <ul v-else class="mt-4 divide-y divide-default"><li v-for="request in data.overview.recent" :key="request.id"><NuxtLink :to="`/requests/${request.id}`" class="flex items-center justify-between gap-3 rounded py-3 focus-visible:outline-2 focus-visible:outline-primary"><span class="min-w-0"><span class="block truncate text-sm font-medium">{{ request.title }}</span><span class="text-xs text-muted">{{ formatDate(request.updatedAt) }}</span></span><StatusBadge :status="request.status" /></NuxtLink></li></ul>
      <div class="mt-3 text-right"><UButton to="/requests" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right">{{ t('features.serviceRequests.dashboard.viewAll') }}</UButton></div>
    </template>
  </UCard>
</template>
