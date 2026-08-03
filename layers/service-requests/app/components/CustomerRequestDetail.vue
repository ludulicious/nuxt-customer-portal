<script setup lang="ts">
import type { ServiceRequest } from '#layers/service-requests/shared/types/service-request'

const props = defineProps<{
  requestId: string
  canEdit?: boolean
  canDelete?: boolean
}>()
const { t } = useI18n()
const { getPriorityColor } = useServiceRequests()
defineEmits<{
  edit: []
  delete: []
}>()
const { getRequest } = useServiceRequests()
const request = ref<ServiceRequest | null>(await getRequest(props.requestId))

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <div v-if="request" class="space-y-6">
    <div class="flex justify-between items-start">
      <div>
        <div class="flex gap-2 mt-2">
          <UBadge :color="getPriorityColor(request.priority)">
            {{ request.priority }}
          </UBadge>
          <StatusBadge :status="request.status" />
          <UBadge v-if="request.category" variant="soft">
            {{ request.category }}
          </UBadge>
        </div>
      </div>

      <div class="flex gap-2">
        <UButton
          v-if="canEdit"
          variant="ghost"
          @click="$emit('edit')"
        >
          {{ t('features.serviceRequests.edit') }}
        </UButton>
        <UButton
          v-if="canDelete"
          variant="ghost"
          color="error"
          @click="$emit('delete')"
        >
          {{ t('features.serviceRequests.delete') }}
        </UButton>
      </div>
    </div>

    <USeparator />

    <div class="prose dark:prose-invert max-w-none">
      <h3>{{ t('features.serviceRequests.fields.description') }}</h3>
      <p>{{ request.description }}</p>
    </div>

    <USeparator />

    <div class="grid grid-cols-2 gap-4 text-sm">
      <!-- <div>
        <span class="font-semibold">{{ t('features.serviceRequests.fields.createdBy') }}:</span>
        {{ request.createdBy?.name || request.createdBy?.email }}
      </div> -->
      <div>
        <span class="font-semibold">{{ t('features.serviceRequests.fields.createdAt') }}:</span>
        {{ formatDate(request.createdAt) }}
      </div>
      <!-- <div v-if="request.assignedTo">
        <span class="font-semibold">{{ t('features.serviceRequests.fields.assignedTo') }}:</span>
        {{ request.assignedTo.name || request.assignedTo.email }}
      </div> -->
      <div v-if="request.resolvedAt">
        <span class="font-semibold">{{ t('features.serviceRequests.fields.resolvedAt') }}:</span>
        {{ formatDate(request.resolvedAt) }}
      </div>
    </div>
  </div>
</template>
