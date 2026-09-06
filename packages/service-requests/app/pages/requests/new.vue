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
  <div class="mx-auto h-full min-h-0 w-full max-w-3xl overflow-y-auto px-4 py-5 sm:px-6">
    <UButton to="/requests" icon="i-lucide-arrow-left" color="neutral" variant="ghost" class="mb-4">{{
      t('features.serviceRequests.actions.back')
    }}</UButton>
    <h1 class="mb-2 flex items-center gap-3 text-xl font-semibold">
      <UIcon name="i-lucide-ticket" class="size-5 text-primary" />{{ t('features.serviceRequests.create') }}
    </h1>

    <p class="mb-6 text-sm text-muted">{{ t('features.serviceRequests.list.createDescription') }}</p>
    <UCard><CustomerRequestForm :loading="loading" @submit="handleSubmit" @cancel="navigateTo('/requests')" /></UCard>
  </div>
</template>
