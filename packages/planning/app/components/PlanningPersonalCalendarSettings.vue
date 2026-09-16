<script setup lang="ts">
import { providerSettingsSchema } from '../../shared/validation'

const api = usePlanning(),
  { t } = useI18n()
const calendars = ref<Array<{ id: string; summary: string; accessRole: string }>>([]),
  error = ref(''),
  busy = ref(false),
  ready = ref(false),
  googleConnected = ref(false)
const providerState = reactive({
  timezone: 'Europe/Amsterdam',
  graceMinutes: 0,
  availabilityCalendarTitle: 'Portal availability',
  busyCalendarIds: [] as string[],
  writeCalendarId: ''
})
const mainCalendar = computed(() => calendars.value.find((calendar) => calendar.id === providerState.writeCalendarId))
const mainConfigured = computed(() => googleConnected.value && !!providerState.writeCalendarId)
const writableCalendars = computed(() => calendars.value.filter((calendar) => ['owner', 'writer'].includes(calendar.accessRole)))
const additionalCalendars = computed(() => calendars.value.filter((calendar) => calendar.id !== providerState.writeCalendarId))
const additionalCalendarIds = computed({
  get: () => providerState.busyCalendarIds.filter((id) => id !== providerState.writeCalendarId),
  set: (ids: string[]) => {
    providerState.busyCalendarIds = providerState.writeCalendarId
      ? [...new Set([providerState.writeCalendarId, ...ids])]
      : ids
  }
})

async function load() {
  error.value = ''
  try {
    const settings = await api.provider()
    googleConnected.value = settings.connections.some((connection) => connection.provider === 'google' && connection.healthy)
    Object.assign(providerState, {
      timezone: settings.timezone,
      graceMinutes: settings.graceMinutes,
      availabilityCalendarTitle: settings.availabilityCalendarTitle,
      busyCalendarIds: settings.busyCalendarIds,
      writeCalendarId: settings.writeCalendarId || ''
    })
    calendars.value = googleConnected.value ? await api.calendars() : []
    ready.value = true
  } catch {
    error.value = t('planning.loadError')
  }
}
await load()

async function connectMainCalendar() {
  busy.value = true
  error.value = ''
  try {
    await navigateTo((await api.connect('google')).url, { external: true })
  } catch {
    error.value = t('planning.googleConnectionError')
  } finally {
    busy.value = false
  }
}

async function saveSettings() {
  busy.value = true
  error.value = ''
  try {
    providerState.busyCalendarIds = [...new Set([providerState.writeCalendarId, ...additionalCalendarIds.value])]
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
    <UAlert v-if="error" :title="error" color="error" variant="outline" />

    <UCard v-if="ready && !googleConnected">
      <template #header>
        <div class="flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-calendar-plus" class="size-5" />
          </span>
          <div>
            <h2 class="font-semibold">{{ t('planning.connectMainCalendar') }}</h2>
            <p class="text-sm text-muted">{{ t('planning.connectMainCalendarDescription') }}</p>
          </div>
        </div>
      </template>
      <div class="space-y-4">
        <UAlert :title="t('planning.mainCalendarPermissions')" icon="i-lucide-shield-check" variant="subtle" />
        <UButton icon="i-simple-icons-google" :loading="busy" @click="connectMainCalendar">
          {{ t('planning.connectGoogleCalendar') }}
        </UButton>
      </div>
    </UCard>

    <UForm
      v-else-if="ready"
      :state="providerState"
      :schema="providerSettingsSchema"
      novalidate
      class="space-y-6"
      @submit="saveSettings"
    >
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-semibold">{{ t('planning.mainCalendar') }}</h2>
                <UBadge v-if="mainConfigured" color="success" variant="subtle">{{ t('planning.connected') }}</UBadge>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ mainConfigured ? t('planning.mainCalendarFixedDescription') : t('planning.chooseMainCalendarDescription') }}
              </p>
            </div>
            <UBadge color="primary" variant="outline">{{ t('planning.readWrite') }}</UBadge>
          </div>
        </template>
        <div v-if="mainConfigured" class="flex items-center gap-3 rounded-lg border border-default bg-elevated/40 p-4">
          <span class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-calendar-check" class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ mainCalendar?.summary || providerState.writeCalendarId }}</p>
            <p class="text-sm text-muted">{{ t('planning.portalCalendarDestination') }}</p>
          </div>
          <UIcon name="i-lucide-lock" class="size-4 text-muted" />
        </div>
        <UFormField v-else name="writeCalendarId" :label="t('planning.chooseMainCalendar')">
          <USelectMenu
            v-model="providerState.writeCalendarId"
            :items="writableCalendars.map((calendar) => ({ value: calendar.id, label: calendar.summary }))"
            value-key="value"
            class="w-full"
          />
        </UFormField>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold">{{ t('planning.additionalCalendars') }}</h2>
              <p class="mt-1 text-sm text-muted">{{ t('planning.additionalCalendarsDescription') }}</p>
            </div>
            <UBadge color="neutral" variant="outline">{{ t('planning.readOnly') }}</UBadge>
          </div>
        </template>
        <UFormField name="busyCalendarIds">
          <USelectMenu
            v-model="additionalCalendarIds"
            :items="additionalCalendars.map((calendar) => ({ value: calendar.id, label: calendar.summary }))"
            value-key="value"
            multiple
            :placeholder="t('planning.addConflictCalendars')"
            class="w-full"
          />
        </UFormField>
        <p v-if="!additionalCalendars.length" class="mt-3 text-sm text-muted">{{ t('planning.noAdditionalCalendars') }}</p>
      </UCard>

      <UCard>
        <template #header><h2 class="font-semibold">{{ t('planning.schedulingPreferences') }}</h2></template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            name="availabilityCalendarTitle"
            :label="t('planning.availabilityCalendarTitle')"
            :description="t('planning.availabilityCalendarTitleDescription')"
            class="sm:col-span-2"
          >
            <UInput v-model="providerState.availabilityCalendarTitle" class="w-full" />
          </UFormField>
          <UFormField name="timezone" :label="t('planning.timezone')">
            <USelectMenu
              v-model="providerState.timezone"
              :items="Intl.supportedValuesOf('timeZone').map((value) => ({ value, label: value.replaceAll('_', ' ') }))"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField name="graceMinutes" :label="t('planning.graceMinutes')">
            <UInputNumber v-model="providerState.graceMinutes" :min="0" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <div class="flex justify-end">
        <UButton type="submit" :loading="busy">{{ mainConfigured ? t('planning.save') : t('planning.setMainCalendar') }}</UButton>
      </div>
    </UForm>
  </div>
</template>
