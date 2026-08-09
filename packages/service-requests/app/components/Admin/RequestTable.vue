<script setup lang="ts">
import type {
  AdminServiceRequestUpdateInput,
  ServiceRequestFilters,
  ServiceRequestPagination,
  ServiceRequestPriority,
  ServiceRequest
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

defineProps<{
  requests: readonly ServiceRequest[]
  loading: boolean
  pagination: ServiceRequestPagination
}>()

const emit = defineEmits<{
  select: [id: string]
  filter: [filters: ServiceRequestFilters]
  assign: [id: string]
  update: [data: { id: string, updates: AdminServiceRequestUpdateInput }]
}>()
const { t } = useI18n()

const currentPage = ref(1)
const filters = reactive({
  status: undefined,
  priority: undefined,
  search: ''
})

watch(filters, () => {
  emit('filter', filters)
})

watch(currentPage, (page) => {
  emit('filter', { ...filters, page })
})

const getActions = (request: ServiceRequest) => {
  return [[
    { label: t('features.serviceRequests.actions.view'), click: () => emit('select', request.id) },
    { label: t('features.serviceRequests.actions.assign'), click: () => emit('assign', request.id) },
    { label: t('features.serviceRequests.actions.resolve'), click: () => emit('update', { id: request.id, updates: { status: 'RESOLVED' } }) },
    { label: t('features.serviceRequests.actions.close'), click: () => emit('update', { id: request.id, updates: { status: 'CLOSED' } }) }
  ]]
}

const statusOptions = computed(() => [
  { label: t('features.serviceRequests.status.open'), value: 'OPEN' },
  { label: t('features.serviceRequests.status.in_progress'), value: 'IN_PROGRESS' },
  { label: t('features.serviceRequests.status.resolved'), value: 'RESOLVED' },
  { label: t('features.serviceRequests.status.closed'), value: 'CLOSED' }
])

const priorityOptions = computed(() => [
  { label: t('features.serviceRequests.priority.low'), value: 'LOW' },
  { label: t('features.serviceRequests.priority.medium'), value: 'MEDIUM' },
  { label: t('features.serviceRequests.priority.high'), value: 'HIGH' },
  { label: t('features.serviceRequests.priority.urgent'), value: 'URGENT' }
])

const getPriorityColor = (priority: ServiceRequestPriority) => {
  switch (priority) {
    case 'LOW': return 'success'
    case 'MEDIUM': return 'info'
    case 'HIGH': return 'warning'
    case 'URGENT': return 'error'
    default: return 'neutral'
  }
}
</script>

<template>
  <UCard>
    <!-- Filters -->
    <div class="flex gap-2 mb-4">
      <USelect v-model="filters.status" :options="statusOptions" :placeholder="t('features.serviceRequests.fields.status')" />
      <USelect v-model="filters.priority" :options="priorityOptions" :placeholder="t('features.serviceRequests.fields.priority')" />
      <UInput v-model="filters.search" :placeholder="t('common.searchPlaceholder')" icon="i-lucide-search" />
    </div>

    <!-- Table -->
    <div v-if="loading">
      <USkeleton v-for="i in 5" :key="i" class="h-12 w-full mb-2" />
    </div>

    <UEmpty
      v-else-if="requests.length === 0"
      icon="i-lucide-ticket"
      :description="t('features.serviceRequests.messages.empty')"
    />

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left">
            <th class="p-3">{{ t('features.serviceRequests.fields.title') }}</th>
            <th class="p-3">{{ t('features.serviceRequests.fields.status') }}</th>
            <th class="p-3">{{ t('features.serviceRequests.fields.priority') }}</th>
            <th class="p-3">{{ t('features.serviceRequests.fields.assignedTo') }}</th>
            <th class="p-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in requests" :key="request.id" class="border-b">
            <td class="p-3">
              <button class="hover:underline" @click="$emit('select', request.id)">{{ request.title }}</button>
            </td>
            <td class="p-3"><StatusBadge :status="request.status" /></td>
            <td class="p-3"><UBadge :color="getPriorityColor(request.priority)">{{ request.priority }}</UBadge></td>
            <td class="p-3">{{ request.assignedToId || '—' }}</td>
            <td class="p-3">
              <UDropdownMenu :items="getActions(request)">
                <UButton variant="ghost" icon="i-lucide-more-vertical" />
              </UDropdownMenu>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.pageCount > 1" class="flex justify-center mt-4">
      <UPagination
        v-model="currentPage"
        :total="pagination.total"
        :page-size="pagination.pageSize"
      />
    </div>
  </UCard>
</template>
