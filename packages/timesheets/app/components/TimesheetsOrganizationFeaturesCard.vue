<script setup lang="ts">
import type { OrganizationTimesheetCapabilities } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'

const props = defineProps<{ organizationId: string, modelValue: OrganizationTimesheetCapabilities }>()
const emit = defineEmits<{ 'update:modelValue': [value: OrganizationTimesheetCapabilities] }>()
const { t } = useI18n()
const toast = useToast()
const api = useTimesheets()
const busy = ref(false)
const update = async (change: Partial<Pick<OrganizationTimesheetCapabilities, 'workspaceEnabled' | 'invoicingEnabled'>>) => {
  const next = { ...props.modelValue, ...change }
  if (!next.workspaceEnabled) next.invoicingEnabled = false
  busy.value = true
  try {
    await api.updateOrganizationTimesheetCapabilities(props.organizationId, { workspaceEnabled: next.workspaceEnabled, invoicingEnabled: next.invoicingEnabled })
    emit('update:modelValue', next)
    toast.add({ title: t('features.timesheets.organizationFeatures.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
</script>

<template>
  <UCard>
    <template #header><div class="flex items-center gap-2"><UIcon name="i-lucide-blocks" class="size-5" /><h2 class="text-lg font-semibold">{{ t('features.timesheets.organizationFeatures.title') }}</h2></div></template>
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-4"><div><p class="font-medium">{{ t('features.timesheets.organizationFeatures.workspace') }}</p><p class="text-sm text-muted">{{ t('features.timesheets.organizationFeatures.workspaceDescription') }}</p></div><USwitch :model-value="modelValue.workspaceEnabled" :disabled="busy" @update:model-value="update({ workspaceEnabled: $event })" /></div>
      <div class="flex items-start justify-between gap-4 border-t border-default pt-4"><div><p class="font-medium">{{ t('features.timesheets.organizationFeatures.invoicing') }}</p><p class="text-sm text-muted">{{ t('features.timesheets.organizationFeatures.invoicingDescription') }}</p></div><USwitch :model-value="modelValue.invoicingEnabled" :disabled="busy || !modelValue.workspaceEnabled" @update:model-value="update({ invoicingEnabled: $event })" /></div>
      <div class="border-t border-default pt-4"><p class="font-medium">{{ t('features.timesheets.organizationFeatures.clientRelationships') }}</p><p v-if="!modelValue.clientOf.length" class="mt-1 text-sm text-muted">{{ t('features.timesheets.organizationFeatures.noClientRelationships') }}</p><div v-else class="mt-2 flex flex-wrap gap-2"><UBadge v-for="relationship in modelValue.clientOf" :key="relationship.workspaceOrganizationId" color="neutral" variant="subtle">{{ relationship.workspaceName }} · {{ t(`features.timesheets.clientAccess.${relationship.accessMode.toLowerCase()}`) }}</UBadge></div></div>
    </div>
  </UCard>
</template>
