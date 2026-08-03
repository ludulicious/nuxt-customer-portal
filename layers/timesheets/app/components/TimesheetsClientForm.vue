<script setup lang="ts">
import { z } from 'zod'
import type { TimesheetsAdminBootstrap } from '#layers/timesheets/app/composables/useTimesheets'

defineProps<{
  data: TimesheetsAdminBootstrap
  busy: boolean
  showCancel: boolean
}>()
const emit = defineEmits<{ submit: [], cancel: [] }>()
const organizationId = defineModel<string>({ required: true })
const { t } = useI18n()
const state = computed(() => ({ organizationId: organizationId.value }))
const schema = computed(() => z.object({
  organizationId: z.string().min(1, t('features.timesheets.validation.required'))
}))
</script>

<template>
  <UCard>
    <template #header><h2 class="font-semibold">{{ t('features.timesheets.admin.newClient') }}</h2></template>
    <UForm :state="state" :schema="schema" class="space-y-4" @submit="emit('submit')">
      <UFormField name="organizationId" :label="t('features.timesheets.admin.organization')" required>
        <USelect
          v-model="organizationId"
          :items="data.availableClientOrganizations.map(item => ({ label: item.name, value: item.id }))"
          value-key="value"
          class="w-full"
        />
      </UFormField>
      <p v-if="!data.availableClientOrganizations.length" class="text-sm text-muted">
        {{ t('features.timesheets.admin.noAvailableClientOrganizations') }}
      </p>
      <UButton type="submit" block :loading="busy">
        {{ t('features.timesheets.admin.linkClient') }}
      </UButton>
      <UButton v-if="showCancel" type="button" block color="neutral" variant="ghost" @click="emit('cancel')">
        {{ t('features.timesheets.cancel') }}
      </UButton>
    </UForm>
  </UCard>
</template>
