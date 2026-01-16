<script setup lang="ts">
const route = useRoute()
const requestId = route.params.id as string

const { getRequest, updateRequest, deleteRequest } = useServiceRequests()
const userStore = useUserStore()
const toast = useToast()

const request = ref<ServiceRequestWithRelations | null>(null)
const loading = ref(true)
const updating = ref(false)
const showEditModal = ref(false)

const canEdit = computed(() => {
  return request.value?.createdById === userStore.currentUser?.id
})

const canDelete = computed(() => {
  return request.value?.createdById === userStore.currentUser?.id
})

onMounted(async () => {
  try {
    request.value = await getRequest(requestId)
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to load request',
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
      title: 'Success',
      description: 'Request updated successfully'
    })
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to update request',
      color: 'error'
    })
  } finally {
    updating.value = false
  }
}

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this request?')) return

  try {
    await deleteRequest(requestId)
    toast.add({
      title: 'Success',
      description: 'Request deleted successfully'
    })
    navigateTo('/requests')
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to delete request',
      color: 'error'
    })
  }
}

definePageMeta({
  middleware: 'auth'
})
</script>

<template>
  <div class="container mx-auto py-8 max-w-4xl">
    <div v-if="loading">
      <USkeleton class="h-32 w-full mb-4" />
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="!request" class="text-center py-8">
      <p>Request not found</p>
      <UButton @click="navigateTo('/requests')">Back to Requests</UButton>
    </div>

    <div v-else>
      <CustomerRequestDetail
        :request="request"
        :can-edit="canEdit"
        :can-delete="canDelete"
        @edit="showEditModal = true"
        @delete="handleDelete"
      />

      <!-- Edit Modal -->
      <UModal v-model="showEditModal">
        <UCard>
          <template #header>
            <h2 class="text-xl font-bold">Edit Request</h2>
          </template>

          <CustomerRequestForm
            :initial-data="request"
            :loading="updating"
            @submit="handleUpdate"
            @cancel="showEditModal = false"
          />
        </UCard>
      </UModal>
    </div>
  </div>
</template>
