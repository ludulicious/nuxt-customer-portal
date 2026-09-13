<script setup lang="ts">
import { z } from 'zod'
import { availabilitySchema } from '../../shared/validation'
import type { AvailabilityWindow } from '../../shared/types'
import type { ProviderConfiguration, AppointmentListItem } from '../composables/usePlanning'
import { localParts } from '../../shared/availability'

const { activeOrganizationRole } = usePortalSession()
const canManagePlanning = computed(() => ['owner', 'admin'].includes(activeOrganizationRole.value || ''))

const api = usePlanning(),
  { t, locale } = useI18n(),
  settings = ref<ProviderConfiguration>(),
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
  } catch {
    error.value = t('planning.loadError')
  }
}
onMounted(load)
function toggleProduct(id: string, checked: boolean) {
  const ids = windowState.productIds || []
  windowState.productIds = checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id)
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
                  ><UInput v-model="windowState.endTime" type="time" class="w-full"
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
