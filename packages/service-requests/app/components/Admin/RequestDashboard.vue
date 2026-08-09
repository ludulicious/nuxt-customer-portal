<script setup lang="ts">
import type {
  AdminServiceRequestUpdateInput,
  ServiceRequestFilters,
  ServiceRequestPagination,
  ServiceRequest
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

defineProps<{
  requests: readonly ServiceRequest[]
  loading: boolean
  pagination: ServiceRequestPagination
  stats: Record<string, number>
}>()

defineEmits<{
  select: [id: string]
  filter: [filters: ServiceRequestFilters]
  update: [data: { id: string, updates: AdminServiceRequestUpdateInput }]
}>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-blue-600">{{ stats.OPEN || 0 }}</div>
          <div class="text-sm text-gray-600">{{ t('features.serviceRequests.status.open') }}</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-yellow-600">{{ stats.IN_PROGRESS || 0 }}</div>
          <div class="text-sm text-gray-600">{{ t('features.serviceRequests.status.in_progress') }}</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-green-600">{{ stats.RESOLVED || 0 }}</div>
          <div class="text-sm text-gray-600">{{ t('features.serviceRequests.status.resolved') }}</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-gray-600">{{ stats.CLOSED || 0 }}</div>
          <div class="text-sm text-gray-600">{{ t('features.serviceRequests.status.closed') }}</div>
        </div>
      </UCard>
    </div>

    <!-- Filters and Table -->
    <AdminRequestTable :requests="requests" :loading="loading" :pagination="pagination"
      @select="$emit('select', $event)" @filter="$emit('filter', $event)" @update="$emit('update', $event)" />
  </div>
</template>
