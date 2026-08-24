<script setup lang="ts">
import type { ServiceRequestCreateInput } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const { createRequest, loading } = useServiceRequests()
const toast = useToast()
const { t } = useI18n()

useSeoMeta({
  title: () => t('features.serviceRequests.create')
})

const handleSubmit = async (data: ServiceRequestCreateInput) => {
  try {
    await createRequest(data)
    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.createSuccess')
    })
    navigateTo('/requests')
  } catch (error) {
    console.error(error)
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.createError'),
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="container mx-auto py-8 max-w-2xl">
    <h1 class="text-3xl font-bold mb-6">{{ t('features.serviceRequests.create') }}</h1>

    <CustomerRequestForm :loading="loading" @submit="handleSubmit" @cancel="navigateTo('/requests')" />
  </div>
</template>
