<script setup lang="ts">
import { providerSettingsSchema } from '../../shared/validation'

const api = usePlanning(),
  { t } = useI18n()
const calendars = ref<Array<{ id: string; summary: string; accessRole: string }>>([]),
  error = ref(''),
  busy = ref(false),
  ready = ref(false)
const providerState = reactive({
  timezone: 'Europe/Amsterdam',
  graceMinutes: 0,
  busyCalendarIds: [] as string[],
  writeCalendarId: ''
})
const calendarOptions = computed(() => calendars.value.map((c) => ({ value: c.id, label: c.summary })))
async function load() {
  error.value = ''
  try {
    const settings = await api.provider()
    Object.assign(providerState, {
      timezone: settings.timezone,
      graceMinutes: settings.graceMinutes,
      busyCalendarIds: settings.busyCalendarIds,
      writeCalendarId: settings.writeCalendarId || ''
    })
    calendars.value = settings.connections.some((c) => c.provider === 'google' && c.healthy)
      ? await api.calendars()
      : []
    ready.value = true
  } catch {
    error.value = t('planning.loadError')
  }
}
onMounted(load)
async function saveSettings() {
  busy.value = true
  try {
    await api.saveProvider(providerState)
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PlanningPersonalConnection provider="google" @changed="load" /><UAlert
      v-if="error"
      :title="error"
      color="error"
      variant="outline"
    />
    <UCard v-if="ready"
      ><template #header
        ><h2 class="font-semibold">{{ t('planning.calendarSettings') }}</h2></template
      ><UForm
        :state="providerState"
        :schema="providerSettingsSchema"
        novalidate
        class="grid gap-4 sm:grid-cols-2"
        @submit="saveSettings"
        ><UFormField name="timezone" :label="t('planning.timezone')"
          ><USelectMenu
            v-model="providerState.timezone"
            :items="Intl.supportedValuesOf('timeZone')"
            class="w-full" /></UFormField
        ><UFormField name="graceMinutes" :label="t('planning.graceMinutes')"
          ><UInputNumber v-model="providerState.graceMinutes" :min="0" class="w-full" /></UFormField
        ><UFormField name="busyCalendarIds" :label="t('planning.busyCalendars')"
          ><USelectMenu
            v-model="providerState.busyCalendarIds"
            :items="calendarOptions"
            value-key="value"
            multiple
            class="w-full" /></UFormField
        ><UFormField name="writeCalendarId" :label="t('planning.writeCalendar')"
          ><USelect
            v-model="providerState.writeCalendarId"
            :items="
              calendars
                .filter((c) => ['owner', 'writer'].includes(c.accessRole))
                .map((c) => ({ value: c.id, label: c.summary }))
            "
            class="w-full" /></UFormField
        ><UButton type="submit" :loading="busy" class="justify-center">{{ t('planning.save') }}</UButton></UForm
      ></UCard
    >
  </div>
</template>
