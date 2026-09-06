<script setup lang="ts">
import type { ServiceRequest } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

defineProps<{ request: ServiceRequest; canEdit?: boolean; canDelete?: boolean }>()
defineEmits<{ edit: []; delete: [] }>()
const { t, locale } = useI18n()
const { getPriorityColor, getPriorityBadgeText, getStatusColor, getStatusBadgeText } = useServiceRequests()
const formatDate = (date: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(date))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="break-words text-xl font-semibold text-highlighted">{{ request.title }}</h1>
          <div class="mt-3 flex flex-wrap gap-2">
            <UBadge :color="getStatusColor(request.status)" variant="subtle">{{
              getStatusBadgeText(request.status)
            }}</UBadge>
            <UBadge :color="getPriorityColor(request.priority)" variant="subtle">{{
              getPriorityBadgeText(request.priority)
            }}</UBadge>
            <UBadge v-if="request.category" color="neutral" variant="subtle">{{ request.category }}</UBadge>
          </div>
        </div>
        <div v-if="canEdit || canDelete" class="flex gap-2">
          <UButton v-if="canEdit" icon="i-lucide-pencil" color="neutral" variant="outline" @click="$emit('edit')">{{
            t('common.edit')
          }}</UButton>
          <UButton
            v-if="canDelete"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :aria-label="t('features.serviceRequests.delete')"
            @click="$emit('delete')"
          />
        </div>
      </div>
    </template>
    <div class="space-y-6">
      <div>
        <h2 class="text-sm font-semibold text-highlighted">{{ t('features.serviceRequests.fields.description') }}</h2>
        <p class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{{ request.description }}</p>
      </div>
      <dl class="grid grid-cols-1 gap-4 border-t border-default pt-4 text-sm sm:grid-cols-3">
        <div v-if="request.clientName">
          <dt class="text-muted">{{ t('features.serviceRequests.fields.client') }}</dt>
          <dd class="mt-1 font-medium">{{ request.clientName }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('features.serviceRequests.fields.createdAt') }}</dt>
          <dd class="mt-1 font-medium">{{ formatDate(request.createdAt) }}</dd>
        </div>
        <div v-if="request.resolvedAt">
          <dt class="text-muted">{{ t('features.serviceRequests.fields.resolvedAt') }}</dt>
          <dd class="mt-1 font-medium">{{ formatDate(request.resolvedAt) }}</dd>
        </div>
      </dl>
    </div>
  </UCard>
</template>
