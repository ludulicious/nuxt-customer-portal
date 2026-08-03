<script setup lang="ts">
import type {
  AdminServiceRequestUpdateInput,
  ServiceRequestWithRelations
} from '#layers/service-requests/shared/types/service-request'

const route = useRoute()
const { t } = useI18n()
const requestId = route.params.id as string

const { adminUpdateRequest } = useAdminServiceRequests()
const toast = useToast()

const request = ref<ServiceRequestWithRelations | null>(null)
const loading = ref(true)
const updating = ref(false)

useSeoMeta({
  title: () => request.value?.title || t('features.serviceRequests.navigation.manageRequests')
})

const adminUpdates = reactive<AdminServiceRequestUpdateInput>({
  status: undefined,
  priority: undefined,
  assignedToId: '',
  internalNotes: ''
})

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

const userOptions = [
  // This would be populated with users from the organization
  { label: t('features.serviceRequests.placeholders.selectUser'), value: '' }
]

onMounted(async () => {
  try {
    request.value = await $fetch(`/api/service-requests/${requestId}`)
    if (!request.value) return
    adminUpdates.status = request.value.status
    adminUpdates.priority = request.value.priority
    adminUpdates.assignedToId = request.value.assignedToId || ''
    adminUpdates.internalNotes = request.value.internalNotes || ''
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.fetchError'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
})

const handleUpdate = async () => {
  updating.value = true
  try {
    request.value = await adminUpdateRequest(requestId, adminUpdates)
    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.updateSuccess')
    })
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.updateError'),
      color: 'error'
    })
  } finally {
    updating.value = false
  }
}

const handleQuickUpdate = () => {
  handleUpdate()
}

</script>

<template>
  <div class="container mx-auto py-8 max-w-4xl">
    <div v-if="loading">
      <USkeleton class="h-32 w-full mb-4" />
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="request" class="space-y-6">
      <!-- Full request details with admin controls -->
      <CustomerRequestDetail :request-id="request.id" />

      <USeparator />

      <!-- Admin Actions -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">{{ t('features.serviceRequests.actions.adminActions') }}</h3>
        </template>

        <div class="space-y-4">
          <UFormField :label="t('features.serviceRequests.fields.status')">
            <USelect
              v-model="adminUpdates.status"
              :options="statusOptions"
              @change="handleQuickUpdate"
            />
          </UFormField>

          <UFormField :label="t('features.serviceRequests.fields.priority')">
            <USelect
              v-model="adminUpdates.priority"
              :options="priorityOptions"
              @change="handleQuickUpdate"
            />
          </UFormField>

          <UFormField :label="t('features.serviceRequests.fields.assignedTo')">
            <USelect
              v-model="adminUpdates.assignedToId"
              :options="userOptions"
              @change="handleQuickUpdate"
            />
          </UFormField>

          <UFormField :label="t('features.serviceRequests.fields.internalNotes')">
            <UTextarea
              v-model="adminUpdates.internalNotes"
              :rows="4"
              :placeholder="t('features.serviceRequests.placeholders.internalNotes')"
            />
          </UFormField>

          <UButton :loading="updating" @click="handleUpdate">
            {{ t('features.serviceRequests.actions.saveChanges') }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
