<script setup lang="ts">
import { z } from 'zod'
import { localParts, wallInstant } from '../../shared/availability'
import { availabilitySchema } from '../../shared/validation'
import type { AvailabilityWindow } from '../../shared/types'
import type { ProviderConfiguration, AppointmentListItem, CalendarBusyPeriod } from '../composables/usePlanning'

const { activeOrganizationRole } = usePortalSession()
const canManagePlanning = computed(() => ['owner', 'admin'].includes(activeOrganizationRole.value || ''))

const api = usePlanning(),
  { t } = useI18n(),
  settings = ref<ProviderConfiguration>(),
  windows = ref<AvailabilityWindow[]>([]),
  appointments = ref<AppointmentListItem[]>([]),
  externalBusy = ref<CalendarBusyPeriod[]>([]),
  error = ref(''),
  busy = ref(false),
  windowOpen = ref(false),
  deleteOpen = ref(false)
const selected = ref<AvailabilityWindow>(),
  occurrence = ref(''),
  editOne = ref(false)
const route = useRoute()
const week = ref(
  typeof route.query.week === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(route.query.week) &&
    Number.isFinite(Date.parse(route.query.week))
    ? route.query.week
    : new Date().toISOString().slice(0, 10)
)
const calendarTimezone = computed({
  get: () =>
    typeof route.query.timezone === 'string' && Intl.supportedValuesOf('timeZone').includes(route.query.timezone)
      ? route.query.timezone
      : providerState.timezone,
  set: (timezone: string) => {
    void navigateTo(
      {
        query: {
          ...route.query,
          week: week.value,
          timezone: timezone === providerState.timezone ? undefined : timezone
        }
      },
      { replace: true }
    )
  }
})
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
const windowFormSchema = computed(() =>
  availabilitySchema.safeExtend({
    productIds: z
      .array(z.string().min(1).max(100))
      .min(1, t('planning.selectAtLeastOneProduct'))
      .max(100)
      .nullable()
      .default(null),
    endDate: z.union([availabilitySchema.shape.endDate, z.literal('')]).transform((v) => v || null)
  })
)
const allProducts = computed({
  get: () => windowState.productIds === null,
  set: (value) => {
    windowState.productIds = value ? null : []
  }
})
const days = computed(() => {
  const first = new Date(week.value)
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => new Date(first.getTime() + i * 86400000).toISOString().slice(0, 10))
})
const canEditCalendar = computed(() => calendarTimezone.value === providerState.timezone)
watch(canEditCalendar, (value) => {
  if (!value) {
    windowOpen.value = false
    deleteOpen.value = false
  }
})
type CalendarWindow = AvailabilityWindow & {
  sourceDate: string
  split: boolean
  sourceRecurring: boolean
  sourceStart: string
  sourceEnd: string
}
const calendarWindows = computed<CalendarWindow[]>(() => {
  const result: CalendarWindow[] = []
  const first = Date.parse(days.value[0]!) - 2 * 86400000
  for (let i = 0; i < 11; i++) {
    const date = new Date(first + i * 86400000).toISOString().slice(0, 10)
    for (const window of windows.value) {
      if (
        date < window.date ||
        (window.endDate && date > window.endDate) ||
        window.exceptions.includes(date) ||
        (window.recurring ? new Date(date).getUTCDay() !== new Date(window.date).getUTCDay() : date !== window.date)
      ) {
        continue
      }
      try {
        const start = localParts(wallInstant(date, window.startTime, window.timezone), calendarTimezone.value)
        const end = localParts(wallInstant(date, window.endTime, window.timezone), calendarTimezone.value)
        const base = {
          ...window,
          recurring: false,
          sourceRecurring: window.recurring,
          sourceStart: wallInstant(date, window.startTime, window.timezone).toISOString(),
          sourceEnd: wallInstant(date, window.endTime, window.timezone).toISOString(),
          sourceDate: date,
          timezone: calendarTimezone.value,
          endDate: null,
          exceptions: [],
          split: start.date !== end.date
        }
        if (start.date === end.date) {
          result.push({ ...base, date: start.date, startTime: start.time, endTime: end.time })
        } else {
          result.push({ ...base, date: start.date, startTime: start.time, endTime: '24:00' })
          if (end.time !== '00:00') {
            result.push({ ...base, date: end.date, startTime: '00:00', endTime: end.time })
          }
        }
      } catch {
        /* Nonexistent wall times do not produce availability. */
      }
    }
  }
  return result
})
function editCalendarWindow(date: string, displayed: AvailabilityWindow) {
  if (!canEditCalendar.value) {
    return
  }
  const source = windows.value.find((window) => window.id === displayed.id)
  if (source) {
    openWindow((displayed as CalendarWindow).sourceDate || date, source)
  }
}
const endTimeInput = computed({
  get: () => (windowState.endTime === '24:00' ? '00:00' : windowState.endTime),
  set: (value: string) => {
    windowState.endTime = value === '00:00' ? '24:00' : value
  }
})
function providerRange(date: string, startTime: string, endTime: string) {
  const start = localParts(wallInstant(date, startTime, calendarTimezone.value), providerState.timezone)
  const end = localParts(wallInstant(date, endTime, calendarTimezone.value), providerState.timezone)
  const midnight = end.time === '00:00' && Date.parse(end.date) === Date.parse(start.date) + 86400000
  if (!midnight && (start.date !== end.date || end.time <= start.time)) {
    throw new Error('Range crosses provider midnight')
  }
  return { date: start.date, startTime: start.time, endTime: midnight ? '24:00' : end.time }
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
    await loadExternalBusy()
  } catch {
    error.value = t('planning.loadError')
  }
}
async function loadExternalBusy() {
  if (!providerState.busyCalendarIds.length && !providerState.writeCalendarId) {
    externalBusy.value = []
    return
  }
  const from = wallInstant(days.value[0]!, '00:00', calendarTimezone.value)
  const to = wallInstant(
    new Date(Date.parse(days.value[days.value.length - 1]!) + 86400000).toISOString().slice(0, 10),
    '00:00',
    calendarTimezone.value
  )
  const periods = await api.calendarBusy({ from: from.toISOString(), to: to.toISOString() })
  externalBusy.value = Array.isArray(periods) ? periods : []
}
onMounted(load)
watch([week, calendarTimezone], () => {
  if (settings.value) {
    void loadExternalBusy().catch(() => {
      error.value = t('planning.externalCalendarLoadError')
    })
  }
})
async function moveCalendarWindow(
  date: string,
  window: AvailabilityWindow,
  targetDate: string,
  startTime: string,
  endTime: string
) {
  if (busy.value || !canEditCalendar.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const displayed = window as CalendarWindow
    const source = windows.value.find((item) => item.id === window.id)!
    if (displayed.split) {
      throw new Error('Resize the complete window in its original timezone')
    }
    const converted = providerRange(targetDate, startTime, endTime)
    await api.saveWindow(
      {
        ...source,
        ...converted,
        recurring: source.recurring ? false : source.recurring,
        endDate: source.recurring ? null : source.endDate,
        occurrenceDate: source.recurring ? displayed.sourceDate || date : undefined
      },
      window.id
    )
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
function selectCalendarRange(date: string, startTime: string, endTime: string) {
  if (!canEditCalendar.value) {
    return
  }
  try {
    const converted = providerRange(date, startTime, endTime)
    openWindow(converted.date)
    Object.assign(windowState, converted)
  } catch {
    error.value = t('planning.timezoneRangeError')
  }
}
function toggleProduct(id: string, checked: boolean) {
  const ids = windowState.productIds || []
  windowState.productIds = checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id)
}
function openWindow(date: string, window?: AvailabilityWindow) {
  if (!canEditCalendar.value) {
    return
  }
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
  if (!canEditCalendar.value) {
    return
  }
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
  if (!canEditCalendar.value) {
    return
  }
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
  <div class="h-full min-h-0 overflow-hidden">
    <UContainer class="flex h-full min-h-0 flex-col gap-6 py-8"
      ><h1 class="text-2xl font-bold">{{ t('planning.availability') }}</h1>
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
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold">
          {{ t('planning.availability') }} · {{ calendarTimezone.replaceAll('_', ' ') }}
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <PlanningTimezoneSelect v-model="calendarTimezone" :user-timezone="providerState.timezone" :disabled="busy" />
          <UButton
            icon="i-lucide-chevron-left"
            :aria-label="t('planning.previousWeek')"
            variant="outline"
            @click="moveWeek(-1)"
          />

          <UButton
            icon="i-lucide-chevron-right"
            :aria-label="t('planning.nextWeek')"
            variant="outline"
            @click="moveWeek(1)"
          />

          <PlanningTimezoneReadOnlyHover
            :readonly="!canEditCalendar"
            :user-timezone="providerState.timezone"
            @switch-timezone="calendarTimezone = providerState.timezone"
          >
            <UButton :disabled="!canEditCalendar || busy" @click="openWindow(week)">{{
              t('planning.addWindow')
            }}</UButton>
          </PlanningTimezoneReadOnlyHover>
        </div>
      </div>
      <PlanningAvailabilityCalendar
        class="min-h-0 flex-1"
        :days="days"
        :disabled="busy || !canEditCalendar"
        :timezone="calendarTimezone"
        :user-timezone="providerState.timezone"
        :readonly-timezone="!canEditCalendar"
        :products="settings?.products || []"
        :windows="calendarWindows"
        :appointments="appointments"
        :external-busy="externalBusy"
        @switch-timezone="calendarTimezone = providerState.timezone"
        @select="selectCalendarRange"
        @edit="editCalendarWindow"
        @move="moveCalendarWindow"
      />

      <UModal
        v-if="windowOpen"
        v-model:open="windowOpen"
        :title="t(selected ? 'planning.editAvailability' : 'planning.addWindow')"
        :description="t('planning.availabilityFormDescription', { timezone: providerState.timezone })"
        :ui="{ content: 'sm:max-w-lg' }"
      >
        <template #body>
          <UForm :state="windowState" :schema="windowFormSchema" novalidate class="space-y-6" @submit="saveWindow">
            <UAlert v-if="error" :title="error" color="error" variant="outline" />
            <UFormField v-if="selected?.recurring" :label="t('planning.editOne')"
              ><USwitch v-model="editOne"
            /></UFormField>
            <div class="space-y-4">
              <UFormField name="date" :label="t('planning.date')"
                ><UInput v-model="windowState.date" type="date" class="w-full"
              /></UFormField>
              <div class="grid grid-cols-2 gap-4">
                <UFormField name="startTime" :label="t('planning.startTime')"
                  ><UInput v-model="windowState.startTime" type="time" class="w-full"
                /></UFormField>
                <UFormField name="endTime" :label="t('planning.endTime')"
                  ><UInput v-model="endTimeInput" type="time" class="w-full"
                /></UFormField>
              </div>
            </div>
            <div class="space-y-4 border-t border-default pt-5">
              <UFormField name="recurring">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-medium">{{ t('planning.weekly') }}</p>
                    <p class="mt-1 text-sm text-muted">{{ t('planning.weeklyHelp') }}</p>
                  </div>
                  <USwitch
                    v-model="windowState.recurring"
                    :disabled="editOne"
                    :aria-label="t('planning.weekly')"
                    class="mt-0.5 shrink-0"
                  />
                </div>
              </UFormField>
              <UFormField
                v-if="windowState.recurring"
                name="endDate"
                :label="t('planning.endDate')"
                :description="t('planning.endDateHelp')"
              >
                <UInput
                  :model-value="windowState.endDate || undefined"
                  type="date"
                  class="w-full"
                  @update:model-value="windowState.endDate = $event || null"
                />
              </UFormField>
            </div>
            <div class="space-y-4 border-t border-default pt-5">
              <UFormField>
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm font-medium">{{ t('planning.allProducts') }}</p>
                    <p class="mt-1 text-sm text-muted">{{ t('planning.allProductsHelp') }}</p>
                  </div>
                  <USwitch v-model="allProducts" :aria-label="t('planning.allProducts')" class="mt-0.5 shrink-0" />
                </div>
              </UFormField>
              <UFormField v-if="!allProducts" name="productIds" :label="t('planning.products')">
                <div class="space-y-2">
                  <label
                    v-for="product in settings?.products || []"
                    :key="product.id"
                    class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-elevated"
                    :class="
                      windowState.productIds?.includes(product.id) ? 'border-primary bg-primary/5' : 'border-default'
                    "
                  >
                    <UCheckbox
                      :model-value="windowState.productIds?.includes(product.id) || false"
                      :aria-label="product.title"
                      @update:model-value="toggleProduct(product.id, Boolean($event))"
                    />
                    <img
                      v-if="product.thumbnailImageId"
                      :src="`/api/store/media/${encodeURIComponent(product.thumbnailImageId)}`"
                      alt=""
                      class="h-12 w-12 shrink-0 rounded-md object-cover"
                    />
                    <div
                      v-else
                      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-elevated text-muted"
                    >
                      <UIcon name="i-lucide-package" class="size-5" />
                    </div>
                    <span class="min-w-0 break-words text-sm font-medium">{{ product.title }}</span>
                  </label>
                </div>
              </UFormField>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-5">
              <UButton
                v-if="selected"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :disabled="busy"
                @click="deleteOpen = true"
                >{{ t('planning.delete') }}</UButton
              >
              <div class="ml-auto flex flex-wrap justify-end gap-2">
                <UButton color="neutral" variant="outline" :disabled="busy" @click="windowOpen = false">{{
                  t('planning.cancelAction')
                }}</UButton>
                <UButton type="submit" :loading="busy">{{ t('planning.saveAvailability') }}</UButton>
              </div>
            </div>
          </UForm>
        </template>
      </UModal>

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
