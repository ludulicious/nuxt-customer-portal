<script setup lang="ts">
import { z } from 'zod'
import type { TimesheetsAdminBootstrap } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'

const props = defineProps<{
  settings: TimesheetsAdminBootstrap['settings']
  refresh: () => Promise<unknown>
}>()

const { t } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const busy = ref(false)
const draft = reactive({
  currency: 'EUR',
  timezone: 'Europe/Amsterdam',
  defaultVatRateBasisPoints: 2100
})
const percentageFormat: Intl.NumberFormatOptions = {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}
const schema = computed(() => z.object({
  currency: z.string().trim().length(3, t('features.timesheets.validation.currencyLength')),
  timezone: z.string().trim().min(3, t('features.timesheets.validation.required')).max(100),
  defaultVatRateBasisPoints: z.number().int().min(0).max(10_000)
}))

watch(() => props.settings, (settings) => {
  draft.currency = settings.currency
  draft.timezone = settings.timezone
  draft.defaultVatRateBasisPoints = settings.defaultVatRateBasisPoints
}, { immediate: true })

const save = async () => {
  busy.value = true
  try {
    await timesheets.updateSettings(draft)
    await props.refresh()
    toast.add({ title: t('features.timesheets.messages.settingsSaved'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('features.timesheets.messages.saveError'),
      description: String(error),
      color: 'error'
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard>
    <UForm :state="draft" :schema="schema" class="space-y-4" @submit="save">
      <UFormField name="currency" :label="t('features.timesheets.admin.currency')" required>
        <UInput v-model="draft.currency" maxlength="3" class="w-full uppercase" />
      </UFormField>
      <UFormField name="timezone" :label="t('features.timesheets.admin.timezone')" required>
        <UInput v-model="draft.timezone" class="w-full" />
      </UFormField>
      <UFormField name="defaultVatRateBasisPoints" :label="t('features.timesheets.admin.defaultVatRate')" required>
        <UInputNumber
          :model-value="draft.defaultVatRateBasisPoints / 10_000"
          :min="0"
          :max="1"
          :step="0.0001"
          :format-options="percentageFormat"
          :increment="false"
          :decrement="false"
          :ui="{ base: 'text-right' }"
          class="w-full"
          @update:model-value="draft.defaultVatRateBasisPoints = Math.round(Number($event ?? 0) * 10_000)"
        />
      </UFormField>
      <UButton type="submit" block icon="i-lucide-save" :loading="busy">
        {{ t('features.timesheets.save') }}
      </UButton>
    </UForm>
  </UCard>
</template>
