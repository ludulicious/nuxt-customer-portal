<script setup lang="ts">
const { t } = useI18n()
const { data, pending, error, refresh } = await useServiceRequestsDashboard()
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('features.serviceRequests.dashboard.attention.title') }}</h2>
        <UIcon name="i-lucide-triangle-alert" class="size-5 text-warning" />
      </div>
    </template>
    <div v-if="pending" class="space-y-3"><USkeleton class="h-8 w-24" /><USkeleton class="h-4 w-full" /></div>
    <div v-else-if="error" class="py-3 text-center">
      <p class="text-sm text-muted">{{ t('features.serviceRequests.dashboard.error') }}</p>
      <UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" @click="refresh()">
        {{ t('features.serviceRequests.dashboard.retry') }}
      </UButton>
    </div>
    <template v-else-if="data?.attention">
      <div class="flex flex-wrap gap-2">
        <UBadge v-if="data.attention.urgentCount" color="error" variant="subtle">
          {{ t('features.serviceRequests.dashboard.urgent', { count: data.attention.urgentCount }) }} </UBadge
        ><UBadge v-if="data.attention.unassignedCount" color="warning" variant="subtle">
          {{ t('features.serviceRequests.dashboard.unassigned', { count: data.attention.unassignedCount }) }} </UBadge
        ><UBadge v-if="data.attention.longOpenCount" color="neutral" variant="subtle">
          {{ t('features.serviceRequests.dashboard.longOpen', { count: data.attention.longOpenCount }) }}
        </UBadge>
      </div>
      <p v-if="!data.attention.items.length" class="py-6 text-center text-sm text-muted">
        {{ t('features.serviceRequests.dashboard.attention.empty') }}
      </p>
      <ul v-else class="mt-4 divide-y divide-default">
        <li v-for="request in data.attention.items.slice(0, 3)" :key="request.id">
          <NuxtLink
            :to="`/admin/requests/${request.id}`"
            class="flex items-center justify-between gap-3 rounded py-3 focus-visible:outline-2 focus-visible:outline-primary"
            ><span class="truncate text-sm font-medium">{{ request.title }}</span
            ><UBadge
              :color="request.priority === 'URGENT' ? 'error' : request.priority === 'HIGH' ? 'warning' : 'neutral'"
              variant="subtle"
              >{{ t(`features.serviceRequests.priority.${request.priority.toLowerCase()}`) }}</UBadge
            ></NuxtLink
          >
        </li>
      </ul>
      <div class="mt-3 text-right">
        <UButton to="/admin/requests" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right">
          {{ t('features.serviceRequests.dashboard.manage') }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
