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
  update: [data: { id: string; updates: AdminServiceRequestUpdateInput }]
}>()
const { t } = useI18n()

const currentPage = ref(1)
const assignees = ref<Array<{ id: string; name: string }>>([])
const filters = reactive({
  status: undefined,
  priority: undefined,
  assignedToId: undefined,
  sortBy: 'createdAt' as 'createdAt' | 'requestedDate' | 'status' | 'priority',
  sortDir: 'desc' as 'asc' | 'desc',
  search: ''
})

onMounted(async () => {
  assignees.value = await $fetch('/api/service-requests/admin/assignees')
})

watch(filters, () => {
  emit('filter', filters)
})

watch(currentPage, (page) => {
  emit('filter', { ...filters, page })
})

const getActions = (request: ServiceRequest) => {
  return [
    [
      { label: t('features.serviceRequests.actions.view'), click: () => emit('select', request.id) },
      { label: t('features.serviceRequests.actions.assign'), click: () => emit('assign', request.id) },
      {
        label: t('features.serviceRequests.status.evaluating'),
        click: () => emit('update', { id: request.id, updates: { status: 'EVALUATING' } })
      },
      {
        label: t('features.serviceRequests.status.completed'),
        click: () => emit('update', { id: request.id, updates: { status: 'COMPLETED' } })
      }
    ]
  ]
}

const statusOptions = computed(() => [
  { label: t('features.serviceRequests.status.new'), value: 'NEW' },
  { label: t('features.serviceRequests.status.evaluating'), value: 'EVALUATING' },
  { label: t('features.serviceRequests.status.awaiting_approval'), value: 'AWAITING_APPROVAL' },
  { label: t('features.serviceRequests.status.accepted'), value: 'ACCEPTED' },
  { label: t('features.serviceRequests.status.in_progress'), value: 'IN_PROGRESS' },
  { label: t('features.serviceRequests.status.completed'), value: 'COMPLETED' },
  { label: t('features.serviceRequests.status.declined'), value: 'DECLINED' },
  { label: t('features.serviceRequests.status.cancelled'), value: 'CANCELLED' }
])

const priorityOptions = computed(() => [
  { label: t('features.serviceRequests.priority.low'), value: 'LOW' },
  { label: t('features.serviceRequests.priority.medium'), value: 'MEDIUM' },
  { label: t('features.serviceRequests.priority.high'), value: 'HIGH' },
  { label: t('features.serviceRequests.priority.urgent'), value: 'URGENT' }
])
const assigneeOptions = computed(() => [
  { label: t('features.serviceRequests.filters.allAssignees'), value: undefined },
  { label: t('features.serviceRequests.filters.unassigned'), value: 'unassigned' },
  ...assignees.value.map((item) => ({ label: item.name, value: item.id }))
])
const sortOptions = computed(() => [
  { label: t('features.serviceRequests.fields.createdAt'), value: 'createdAt' },
  { label: t('features.serviceRequests.fields.requestedDate'), value: 'requestedDate' },
  { label: t('features.serviceRequests.fields.status'), value: 'status' },
  { label: t('features.serviceRequests.fields.priority'), value: 'priority' }
])

const getPriorityColor = (priority: ServiceRequestPriority) => {
  switch (priority) {
    case 'LOW':
      return 'success'
    case 'MEDIUM':
      return 'info'
    case 'HIGH':
      return 'warning'
    case 'URGENT':
      return 'error'
    default:
      return 'neutral'
  }
}
</script>

<template>
  <UCard>
    <!-- Filters -->
    <div class="flex gap-2 mb-4">
      <USelect
        v-model="filters.status"
        :options="statusOptions"
        :placeholder="t('features.serviceRequests.fields.status')"
      />
      <USelect
        v-model="filters.priority"
        :options="priorityOptions"
        :placeholder="t('features.serviceRequests.fields.priority')"
      />
      <UInput v-model="filters.search" :placeholder="t('common.searchPlaceholder')" icon="i-lucide-search" />
      <USelect v-model="filters.assignedToId" :items="assigneeOptions" />
      <USelect v-model="filters.sortBy" :items="sortOptions" />
      <UButton variant="outline" :icon="filters.sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" @click="filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc'" />
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
            <th class="p-3">{{ t('features.serviceRequests.fields.client') }}</th>
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
            <td class="p-3">{{ request.clientName || request.clientOrganizationId }}</td>
            <td class="p-3"><StatusBadge :status="request.status" /></td>
            <td class="p-3">
              <UBadge :color="getPriorityColor(request.priority)">{{ request.priority }}</UBadge>
            </td>
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

    <!-- Result count and pagination -->
    <div class="flex items-center justify-between gap-3 border-t border-default pt-3 text-sm text-muted">
      <span>{{ t('features.serviceRequests.resultCount', { count: pagination.total }) }}</span>
      <UPagination
        v-if="pagination.pageCount > 1"
        v-model="currentPage"
        :total="pagination.total"
        :page-size="pagination.pageSize"
      />
    </div>
  </UCard>
</template>
