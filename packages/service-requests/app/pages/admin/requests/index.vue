<script setup lang="ts">
import type {
  AdminServiceRequestUpdateInput,
  ServiceRequestFilters
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const { requests, loading, pagination, stats, fetchAllRequests, adminUpdateRequest } = useAdminServiceRequests()

const toast = useToast()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

useSeoMeta({
  title: () => t('features.serviceRequests.navigation.manageRequests')
})

onMounted(() => {
  fetchAllRequests({
    search: typeof route.query.search === 'string' ? route.query.search : undefined,
    status: typeof route.query.status === 'string' ? route.query.status as ServiceRequestFilters['status'] : undefined,
    priority: typeof route.query.priority === 'string' ? route.query.priority as ServiceRequestFilters['priority'] : undefined,
    assignedToId: typeof route.query.assignedToId === 'string' ? route.query.assignedToId : undefined,
    page: Number(route.query.page) || 1
  })
})

const handleFilter = (filters: ServiceRequestFilters) => {
  router.replace({ query: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string> })
  fetchAllRequests(filters)
}

const handleUpdate = async ({ id, updates }: { id: string; updates: AdminServiceRequestUpdateInput }) => {
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
