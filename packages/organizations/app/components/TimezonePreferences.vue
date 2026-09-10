<script setup lang="ts">
import { z } from 'zod'
import { isValidTimezone } from '@nuxt-customer-portal/core/shared/timezone'

const props = defineProps<{ provider?: boolean }>()
const { t } = useI18n()
const api = useTimezonePreferences()
const { data, refresh } = await useAsyncData(`timezone-preferences-${props.provider}`, () => api.get())
const state = reactive({
  timezone: (props.provider ? data.value?.providerTimezone : data.value?.userTimezone) ?? (null as string | null)
})
const schema = computed(() =>
  z.object({
    timezone: z
      .string()
      .nullable()
      .refine((value) => (value === null ? !props.provider : isValidTimezone(value)), t('timezones.invalid'))
  })
)
const busy = ref(false)
const error = ref('')
const toast = useToast()
const save = async () => {
  busy.value = true
  error.value = ''
  try {
    if (props.provider) {
      await api.saveProvider(state.timezone!)
    } else {
      await api.saveUser(state.timezone)
    }
    await refresh()
    toast.add({ title: t('timezones.saved'), color: 'success' })
  } catch {
    error.value = t('timezones.failed')
  } finally {
    busy.value = false
  }
}
const suggest = () => {
  state.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
}
</script>

<template>
  <UCard class="mb-6">
    <template #header
      ><h2 class="font-semibold">{{ t(provider ? 'timezones.provider' : 'timezones.preference') }}</h2></template
    >
    <UForm :state="state" :schema="schema" novalidate class="space-y-4" @submit="save">
      <UFormField name="timezone" :label="t('timezones.label')" :description="t('timezones.savedPreference')">
        <PortalTimezoneSelect
          v-model="state.timezone"
          :allow-inherit="!provider"
          :inherited-timezone="data?.schedulingTimezone"
        />
      </UFormField>
      <p v-if="data" class="text-sm text-muted">
        {{ t('timezones.current', { timezone: provider ? data.providerTimezone : data.displayTimezone }) }}
      </p>
      <UAlert v-if="error" color="error" :title="error" />
      <div class="flex justify-end gap-2">
        <UButton v-if="!provider" type="button" variant="outline" @click="suggest">{{
          t('timezones.useDevice')
        }}</UButton>
        <UButton type="submit" :loading="busy">{{ t('timezones.save') }}</UButton>
      </div>
    </UForm>
  </UCard>
</template>
