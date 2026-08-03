<script setup lang="ts">
import type { ServiceRequestStatus } from '#layers/service-requests/shared/types/service-request'

const props = defineProps<{
  status: ServiceRequestStatus
  variant?: 'solid' | 'outline' | 'soft'
}>()

const { getStatusColor, getStatusBadgeText } = useServiceRequests()

</script>

<template>
  <UBadge :color="getStatusColor(props.status)" :variant="variant" size="md">
    {{ getStatusBadgeText(props.status) }}
  </UBadge>
</template>
