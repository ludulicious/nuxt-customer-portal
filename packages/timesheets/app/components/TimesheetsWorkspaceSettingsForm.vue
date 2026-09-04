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
  timerRoundingMinutes: 1,
  currency: 'EUR',
  timezone: 'Europe/Amsterdam'
})
const timezoneOptions = computed(() =>
  [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone'), draft.timezone])].sort()
)
const schema = computed(() =>
  z.object({
    timerRoundingMinutes: z.number().int().min(1).max(60),
    currency: z.string().trim().length(3, t('features.timesheets.validation.currencyLength')),
    timezone: z.string().trim().min(3, t('features.timesheets.validation.required')).max(100)
  })
)

watch(
  () => props.settings,
  (settings) => {
    draft.timerRoundingMinutes = settings.timerRoundingMinutes ?? 1
    draft.currency = settings.currency
    draft.timezone = settings.timezone
  },
  { immediate: true }
)

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
    <UForm novalidate :state="draft" :schema="schema" class="max-w-xl space-y-4" @submit="save">
      <UFormField name="currency" :label="t('features.timesheets.admin.currency')" required>
        <UInput v-model="draft.currency" maxlength="3" class="w-full uppercase sm:w-28" />
      </UFormField>
      <UFormField name="timezone" :label="t('features.timesheets.admin.timezone')" required>
        <USelectMenu v-model="draft.timezone" :items="timezoneOptions" class="w-full sm:w-80" />
      </UFormField>
      <UFormField
        name="timerRoundingMinutes"
        :label="t('features.timesheets.admin.timerRounding')"
        :description="t('features.timesheets.admin.timerRoundingHelp')"
        required
      >
        <UInput v-model.number="draft.timerRoundingMinutes" type="number" :min="1" :max="60" class="w-full sm:w-28" />
      </UFormField>
      <UButton type="submit" class="w-full justify-center sm:w-auto" icon="i-lucide-save" :loading="busy">
        {{ t('features.timesheets.save') }}
      </UButton>
    </UForm>
  </UCard>
</template>
