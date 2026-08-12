<script setup lang="ts">
import type { OrganizationTimesheetCapabilities } from '../composables/useTimesheets'

const props = defineProps<{ organizationId: string }>()
const timesheets = useTimesheets()
const capabilities = ref<OrganizationTimesheetCapabilities | null>(null)
const pending = ref(true)

const load = async () => {
  pending.value = true
  try {
    capabilities.value = await timesheets.getOrganizationTimesheetCapabilities(props.organizationId)
  } finally {
    pending.value = false
  }
}

await load()
</script>

<template>
  <USkeleton v-if="pending" class="h-32 w-full" />
  <template v-else-if="capabilities">
    <TimesheetsOrganizationFeaturesCard
      v-model="capabilities"
      :organization-id="organizationId"
    />
  </template>
</template>
