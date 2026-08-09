<script setup lang="ts">
import { z } from 'zod'

export interface TimesheetsActivityFormModel {
  name: string
  billable: boolean
}

defineProps<{
  editing: boolean
  busy: boolean
  showCancel: boolean
}>()
const emit = defineEmits<{
  submit: []
  cancel: []
}>()
const form = defineModel<TimesheetsActivityFormModel>({ required: true })
const { t } = useI18n()
const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('features.timesheets.validation.activityNameLength')).max(120),
  billable: z.boolean()
}))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">
          {{ editing ? t('features.timesheets.admin.editActivity') : t('features.timesheets.admin.newActivity') }}
        </h2>
        <UButton v-if="editing" type="button" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('features.timesheets.admin.close')" @click="emit('cancel')" />
      </div>
    </template>
    <UForm :state="form" :schema="schema" class="space-y-4" @submit="emit('submit')">
      <UFormField name="name" :label="t('features.timesheets.fields.activity')" required>
        <UInput v-model="form.name" class="w-full" />
      </UFormField>
      <UCheckbox v-model="form.billable" :label="t('features.timesheets.billable')" />
      <div class="flex justify-end gap-2">
        <UButton v-if="showCancel" type="button" color="neutral" variant="outline" @click="emit('cancel')">
          {{ t('features.timesheets.cancel') }}
        </UButton>
        <UButton type="submit" :loading="busy">
          {{ editing ? t('features.timesheets.save') : t('features.timesheets.admin.createActivity') }}
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
