<script setup lang="ts">
import type {
  AdminServiceRequestUpdateInput,
  ServiceRequestFilters
} from '#layers/service-requests/shared/types/service-request'

const {
  requests,
  loading,
  pagination,
  stats,
  fetchAllRequests,
  adminUpdateRequest
} = useAdminServiceRequests()

const toast = useToast()
const { t } = useI18n()

useSeoMeta({
  title: () => t('features.serviceRequests.navigation.manageRequests')
})

onMounted(() => {
  fetchAllRequests()
})

const handleFilter = (filters: ServiceRequestFilters) => {
  fetchAllRequests(filters)
}

const handleUpdate = async ({ id, updates }: { id: string, updates: AdminServiceRequestUpdateInput }) => {
  try {
    await adminUpdateRequest(id, updates)
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
  }
}

</script>

<template>
  <div class="container mx-auto py-8">
    <h1 class="text-3xl font-bold mb-6">{{ t('features.serviceRequests.navigation.manageRequests') }}</h1>

    <AdminRequestDashboard
      :requests="requests"
      :loading="loading"
      :pagination="pagination"
      :stats="stats"
      @select="navigateTo(`/admin/requests/${$event}`)"
      @filter="handleFilter"
      @update="handleUpdate"
    />
  </div>
</template>
