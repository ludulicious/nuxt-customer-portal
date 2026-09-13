<script setup lang="ts">
import { z } from 'zod'
import { availabilitySchema, providerSettingsSchema } from '../../shared/validation'
import type { AvailabilityWindow } from '../../shared/types'
import type { ProviderConfiguration, AppointmentListItem } from '../composables/usePlanning'
import { localParts } from '../../shared/availability'

const { activeOrganizationRole } = usePortalSession()
const canManagePlanning = computed(() => ['owner', 'admin'].includes(activeOrganizationRole.value || ''))

const api = usePlanning(),
  { t, locale } = useI18n(),
  settings = ref<ProviderConfiguration>(),
  calendars = ref<Array<{ id: string; summary: string; accessRole: string }>>([]),
  windows = ref<AvailabilityWindow[]>([]),
  appointments = ref<AppointmentListItem[]>([]),
  error = ref(''),
  busy = ref(false),
  windowOpen = ref(false),
  deleteOpen = ref(false)
const selected = ref<AvailabilityWindow>(),
  occurrence = ref(''),
  editOne = ref(false),
  week = ref(new Date().toISOString().slice(0, 10))
const providerState = reactive({
  timezone: 'Europe/Amsterdam',
  graceMinutes: 0,
  busyCalendarIds: [] as string[],
  writeCalendarId: ''
})
const windowState = reactive<z.infer<typeof availabilitySchema>>({
  date: week.value,
  endDate: null,
  startTime: '09:00',
  endTime: '17:00',
  recurring: false,
  productIds: null,
  exceptions: []
})
const windowFormSchema = availabilitySchema.safeExtend({
  endDate: z.union([availabilitySchema.shape.endDate, z.literal('')]).transform((v) => v || null)
})
const allProducts = computed({
  get: () => windowState.productIds === null,
  set: (value) => {
    windowState.productIds = value ? null : []
  }
})
const calendarOptions = computed(() => calendars.value.map((c) => ({ value: c.id, label: c.summary })))
const days = computed(() => {
  const first = new Date(week.value)
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => new Date(first.getTime() + i * 86400000).toISOString().slice(0, 10))
})
function dayWindows(date: string) {
  return windows.value.filter(
    (w) =>
      date >= w.date &&
      (!w.endDate || date <= w.endDate) &&
      !w.exceptions.includes(date) &&
      (w.recurring ? new Date(date).getUTCDay() === new Date(w.date).getUTCDay() : date === w.date)
  )
}
function dayAppointments(date: string) {
  return appointments.value.filter((a) => localParts(new Date(a.start), providerState.timezone).date === date)
}
watch(editOne, (value) => {
  if (selected.value) {
    Object.assign(
      windowState,
      structuredClone(toRaw(selected.value)),
      value ? { date: occurrence.value, recurring: false, endDate: null } : {}
    )
  }
})
function moveWeek(delta: number) {
  week.value = new Date(Date.parse(week.value) + delta * 7 * 86400000).toISOString().slice(0, 10)
}
async function load() {
  try {
    settings.value = await api.provider()
    Object.assign(providerState, { ...settings.value, writeCalendarId: settings.value.writeCalendarId || '' })
    windows.value = await api.windows()
    appointments.value = await api.providerAppointments()
    if (settings.value.connections.some((c) => c.provider === 'google' && c.healthy)) {
      calendars.value = await api.calendars()
    }
  } catch {
    error.value = t('planning.loadError')
  }
}
onMounted(load)
async function connect(provider: string) {
  busy.value = true
  try {
    await navigateTo((await api.connect(provider)).url, { external: true })
  } catch {
    error.value = t('planning.connectionError')
  } finally {
    busy.value = false
  }
}
async function disconnect(provider: string) {
  busy.value = true
  try {
    await api.disconnect(provider)
    calendars.value = []
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
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
function openWindow(date: string, window?: AvailabilityWindow) {
  selected.value = window
  occurrence.value = date
  editOne.value = false
  Object.assign(
    windowState,
    window
      ? structuredClone(toRaw(window))
      : {
          date,
          endDate: null,
          startTime: '09:00',
          endTime: '17:00',
          recurring: false,
          productIds: null,
          exceptions: []
        }
  )
  windowOpen.value = true
}
async function saveWindow() {
  busy.value = true
  try {
    await api.saveWindow(
      {
        ...windowState,
        endDate: windowState.endDate || null,
        occurrenceDate: editOne.value ? occurrence.value : undefined
      },
      selected.value?.id
    )
    windowOpen.value = false
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
async function removeWindow() {
  if (!selected.value) {
    return
  }
  busy.value = true
  try {
    await api.deleteWindow(selected.value.id, editOne.value ? occurrence.value : undefined)
    deleteOpen.value = false
    windowOpen.value = false
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <UContainer class="space-y-6 py-8"
      ><h1 class="text-2xl font-bold">{{ t('planning.planning') }}</h1>
      <UAlert v-if="error" variant="outline" color="error" :title="error" /><UAlert
        v-if="settings && !settings.enabled"
        variant="outline"
        color="warning"
        :title="t(canManagePlanning ? 'planning.planningDisabledAdmin' : 'planning.planningDisabled')"
      >
        <template v-if="canManagePlanning" #actions>
          <UButton to="/admin/planning" color="neutral" variant="link">{{ t('planning.settings') }}</UButton>
        </template>
      </UAlert>
      <UCard
        ><template #header
          ><h2 class="font-semibold">{{ t('planning.connections') }}</h2></template
        >
        <div class="space-y-4">
          <div v-for="provider in ['google', 'zoom']" :key="provider" class="flex flex-wrap items-center gap-3">
            <span class="font-semibold capitalize">{{ provider }}</span
            ><UBadge
              :color="settings?.connections.some((c) => c.provider === provider && c.healthy) ? 'success' : 'warning'"
              >{{
                t(
                  settings?.connections.some((c) => c.provider === provider && c.healthy)
                    ? 'planning.connected'
                    : 'planning.notConnected'
                )
              }}</UBadge
            ><UButton :loading="busy" variant="outline" @click="connect(provider)">{{ t('planning.connect') }}</UButton
            ><UButton
              v-if="settings?.connections.some((c) => c.provider === provider)"
              color="neutral"
              variant="ghost"
              :disabled="busy"
              @click="disconnect(provider)"
              >{{ t('planning.disconnect') }}</UButton
            >
          </div>
        </div></UCard
      >
      <UCard
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
            ><UInputNumber v-model="providerState.graceMinutes" :min="0" /></UFormField
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
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold">{{ t('planning.availability') }} · {{ providerState.timezone }}</h2>
        <div class="flex gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            :aria-label="t('planning.previousWeek')"
            variant="outline"
            @click="moveWeek(-1)"
          /><UButton
            icon="i-lucide-chevron-right"
            :aria-label="t('planning.nextWeek')"
            variant="outline"
            @click="moveWeek(1)"
          /><UButton @click="openWindow(week)">{{ t('planning.addWindow') }}</UButton>
        </div>
      </div>
      <div class="grid gap-3 md:grid-cols-7">
        <UCard v-for="date in days" :key="date" :ui="{ body: 'p-2 sm:p-2' }"
          ><h3 class="mb-3 text-sm font-semibold">
            {{
              new Intl.DateTimeFormat(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC'
              }).format(new Date(date))
            }}
          </h3>
          <div class="space-y-2">
            <UButton
              v-for="window in dayWindows(date)"
              :key="window.id"
              variant="soft"
              class="w-full justify-start whitespace-normal"
              @click="openWindow(date, window)"
              >{{ window.startTime }}–{{ window.endTime }} {{ window.recurring ? '↻' : '' }}<br />{{
                window.productIds === null ? t('planning.allProducts') : t('planning.selectedProducts')
              }}</UButton
            >
            <div
              v-for="appointment in dayAppointments(date)"
              :key="appointment.id"
              class="rounded border border-default p-2 text-sm"
            >
              <span
                >{{ localParts(new Date(appointment.start), providerState.timezone).time }} ·
                {{ appointment.title }}</span
              ><UBadge v-if="appointment.conflict" color="error">{{ t('planning.conflict') }}</UBadge>
              <p v-if="appointment.effectsError" class="text-error">{{ t('planning.syncError') }}</p>
            </div>
            <UButton
              variant="ghost"
              icon="i-lucide-plus"
              :aria-label="t('planning.addWindow') + ' ' + date"
              @click="openWindow(date)"
            /></div
        ></UCard>
      </div>
      <UModal v-if="windowOpen" v-model:open="windowOpen" :title="t('planning.availability')"
        ><template #body
          ><UForm :state="windowState" :schema="windowFormSchema" novalidate class="space-y-4" @submit="saveWindow"
            ><UFormField v-if="selected?.recurring" :label="t('planning.editOne')"
              ><USwitch
                v-model="editOne"
                @update:model-value="
                  (value) => {
                    if (value) {
                      windowState.date = occurrence
                      windowState.recurring = false
                    }
                  }
                " /></UFormField
            ><UFormField name="date" :label="t('planning.date')"
              ><UInput v-model="windowState.date" type="date"
            /></UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField name="startTime" :label="t('planning.startTime')"
                ><UInput v-model="windowState.startTime" type="time" /></UFormField
              ><UFormField name="endTime" :label="t('planning.endTime')"
                ><UInput v-model="windowState.endTime" type="time"
              /></UFormField>
            </div>
            <UFormField name="recurring" :label="t('planning.weekly')"
              ><USwitch v-model="windowState.recurring" :disabled="editOne" /></UFormField
            ><UFormField v-if="windowState.recurring" name="endDate" :label="t('planning.endDate')"
              ><UInput
                :model-value="windowState.endDate || undefined"
                type="date"
                @update:model-value="windowState.endDate = $event || null" /></UFormField
            ><UFormField :label="t('planning.allProducts')"><USwitch v-model="allProducts" /></UFormField
            ><UFormField v-if="!allProducts" name="productIds" :label="t('planning.products')"
              ><USelectMenu
                :model-value="windowState.productIds || []"
                :items="settings?.products.map((p) => ({ value: p.id, label: p.title })) || []"
                value-key="value"
                multiple
                class="w-full"
                @update:model-value="windowState.productIds = $event"
            /></UFormField>
            <div class="flex gap-3">
              <UButton type="submit" :loading="busy">{{ t('planning.save') }}</UButton
              ><UButton v-if="selected" color="error" variant="outline" @click="deleteOpen = true">{{
                t('planning.delete')
              }}</UButton>
            </div></UForm
          ></template
        ></UModal
      >
      <UModal v-if="deleteOpen" v-model:open="deleteOpen" :title="t('planning.delete')"
        ><template #body
          ><p>{{ t(editOne ? 'planning.deleteOccurrenceConfirm' : 'planning.deleteSeriesConfirm') }}</p>
          <UButton class="mt-4" color="error" :loading="busy" @click="removeWindow">{{
            t('planning.delete')
          }}</UButton></template
        ></UModal
      >
    </UContainer>
  </div>
</template>
