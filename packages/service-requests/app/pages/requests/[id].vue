<script setup lang="ts">
import type {
  ServiceRequestUpdateInput,
  ServiceRequestWithRelations
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const route = useRoute()
const { t } = useI18n()
const requestId = route.params.id as string

const { getRequest, updateRequest, deleteRequest } = useServiceRequests()
const { currentUser } = usePortalSession()
const toast = useToast()

const request = ref<ServiceRequestWithRelations | null>(null)
const loading = ref(true)
const updating = ref(false)
const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const { can } = useServiceRequestAccess()

useSeoMeta({
  title: () => request.value?.title || t('features.serviceRequests.title')
})

const canEdit = computed(() => {
  return request.value?.createdById === currentUser.value?.id || can('update')
})

const canDelete = computed(() => {
  return request.value?.createdById === currentUser.value?.id || can('delete')
})

const backRoute = computed(() => {
  if (route.query.from !== 'list') {
    return '/requests'
  }
  const query: Record<string, string> = {}
  if (route.query.search != null && route.query.search !== '') {
    query.search = String(route.query.search)
  }
  if (route.query.status != null && route.query.status !== '') {
    query.status = String(route.query.status)
  }
  if (route.query.priority != null && route.query.priority !== '') {
    query.priority = String(route.query.priority)
  }
  if (route.query.category != null && route.query.category !== '') {
    query.category = String(route.query.category)
  }
  if (route.query.sortBy != null && route.query.sortBy !== '') {
    query.sortBy = String(route.query.sortBy)
  }
  if (route.query.sortDir != null && route.query.sortDir !== '') {
    query.sortDir = String(route.query.sortDir)
  }
  if (route.query.page != null && route.query.page !== '') {
    query.page = String(route.query.page)
  }
  return { path: '/requests', query }
})

onMounted(async () => {
  try {
    request.value = await getRequest(requestId)
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

const handleUpdate = async (data: ServiceRequestUpdateInput) => {
  updating.value = true
  try {
    request.value = await updateRequest(requestId, data)
    showEditModal.value = false
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

const handleDelete = async () => {
  try {
    await deleteRequest(requestId)
    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.deleteSuccess')
    })
    navigateTo(backRoute.value)
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.deleteError'),
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="mx-auto h-full min-h-0 w-full max-w-5xl overflow-y-auto px-4 py-5 sm:px-6">
    <div class="mb-4">
      <UButton icon="i-lucide-arrow-left" variant="ghost" size="sm" :to="backRoute">
        {{ t('features.serviceRequests.actions.back') }}
      </UButton>
    </div>

    <div v-if="loading">
      <USkeleton class="h-32 w-full mb-4" />
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="!request" class="text-center py-8">
      <p>{{ t('features.serviceRequests.messages.notFound') }}</p>
      <UButton :to="backRoute">{{ t('features.serviceRequests.actions.back') }}</UButton>
    </div>

    <div v-else class="space-y-5">
      <CustomerRequestDetail
        :request="request"
        :can-edit="canEdit"
        :can-delete="canDelete"
        @edit="showEditModal = true"
        @delete="showDeleteConfirm = true"
      />

      <ServiceRequestManagement v-if="can('manage')" :request="request" @updated="request = $event" />
      <UModal v-model:open="showEditModal" :title="t('features.serviceRequests.edit')">
        <template #body>
          <CustomerRequestForm
            :initial-data="request"
            :loading="updating"
            @submit="handleUpdate"
            @cancel="showEditModal = false"
          />
        </template>
      </UModal>
      <ConfirmationModal
        v-model:open="showDeleteConfirm"
        title="features.serviceRequests.delete"
        message="features.serviceRequests.confirmDelete"
        confirm-color="error"
        confirm-text="common.delete"
        @confirm="handleDelete"
      />
    </div>
  </div>
</template>
