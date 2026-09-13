<script setup lang="ts">
import type { Slot } from '../../shared/types'
import { localParts } from '../../shared/availability'
import type { HoldResult } from '../composables/usePlanning'

const props = defineProps<{ productId: string; currency: string; locale: 'en' | 'nl'; replacesId?: string }>()
const emit = defineEmits<{ reserved: [hold: HoldResult] }>()
const api = usePlanning(),
  { t } = useI18n()
const timezone = ref('Europe/Amsterdam'),
  now = new Date(),
  month = ref(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
const selectedDate = ref(''),
  provider = ref('any'),
  slots = ref<Slot[]>([]),
  loading = ref(false),
  busy = ref(false),
  error = ref('')
const timezones = ['UTC', ...Intl.supportedValuesOf('timeZone')]
const monthLabel = computed(() =>
  new Intl.DateTimeFormat(props.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month.value)
)
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(props.locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 5 + i))
    )
  )
)
const days = computed(() => {
  const first = month.value,
    length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(),
    padding = (first.getUTCDay() + 6) % 7
  return [
    ...Array.from({ length: padding }, () => ''),
    ...Array.from({ length }, (_, i) =>
      new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), i + 1)).toISOString().slice(0, 10)
    )
  ]
})
const providerOptions = computed(() => [
  { value: 'any', label: t('planning.anyProvider') },
  ...[...new Map(slots.value.map((s) => [s.providerUserId, s.providerName])).entries()].map(([value, label]) => ({
    value,
    label
  }))
])
const filtered = computed(() =>
  slots.value.filter((s) => provider.value === 'any' || s.providerUserId === provider.value)
)
const availableDates = computed(
  () => new Set(filtered.value.map((s) => localParts(new Date(s.start), timezone.value).date))
)
const daySlots = computed(() => {
  const values = filtered.value.filter((s) => localParts(new Date(s.start), timezone.value).date === selectedDate.value)
  // Any-provider mode shows each instant once; the server binds the chosen concrete provider.
  return provider.value === 'any' ? [...new Map(values.map((s) => [s.start, s])).values()] : values
})
let request = 0
async function load() {
  const current = ++request
  loading.value = true
  error.value = ''
  try {
    const from = new Date(month.value.getTime() - 14 * 3600000),
      mid = new Date(from.getTime() + 16 * 86400000),
      to = new Date(Date.UTC(month.value.getUTCFullYear(), month.value.getUTCMonth() + 1, 1) + 14 * 3600000)
    const values = (
      await Promise.all([
        api.available(props.productId, { from: from.toISOString(), to: mid.toISOString() }, props.replacesId),
        api.available(props.productId, { from: mid.toISOString(), to: to.toISOString() }, props.replacesId)
      ])
    ).flat()
    if (current === request) {
      slots.value = values
      selectedDate.value =
        [...availableDates.value].sort().find((d) => d.slice(0, 7) === month.value.toISOString().slice(0, 7)) || ''
    }
  } catch {
    if (current === request) {
      error.value = t('planning.loadError')
    }
  } finally {
    if (current === request) {
      loading.value = false
    }
  }
}
function move(delta: number) {
  month.value = new Date(Date.UTC(month.value.getUTCFullYear(), month.value.getUTCMonth() + delta, 1))
}
async function choose(slot: Slot) {
  busy.value = true
  error.value = ''
  try {
    emit(
      'reserved',
      await api.reserve({
        productId: props.productId,
        providerUserId: slot.providerUserId,
        start: slot.start,
        customerTimezone: timezone.value,
        currency: props.currency,
        locale: props.locale,
        replacesId: props.replacesId
      })
    )
  } catch {
    error.value = t('planning.slotUnavailable')
    await load()
  } finally {
    busy.value = false
  }
}
watch(month, load)
onMounted(() => {
  timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone
  void load()
})
</script>

<template>
  <div class="space-y-5">
    <UAlert v-if="error" variant="outline" color="error" :title="error" />
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="t('planning.timezone')"
        ><USelectMenu v-model="timezone" :items="timezones" class="w-full"
      /></UFormField>
      <UFormField :label="t('planning.provider')"
        ><USelect v-model="provider" :items="providerOptions" class="w-full"
      /></UFormField>
    </div>
    <div class="flex items-center justify-between">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        :aria-label="t('planning.previousMonth')"
        @click="move(-1)"
      />
      <h2 class="font-semibold">{{ monthLabel }}</h2>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        :aria-label="t('planning.nextMonth')"
        @click="move(1)"
      />
    </div>
    <p v-if="loading" role="status">{{ t('planning.loading') }}</p>
    <div class="grid grid-cols-7 gap-1" :aria-label="monthLabel">
      <span v-for="day in weekdays" :key="day" class="text-center text-sm text-muted">{{ day }}</span>
      <template v-for="(date, index) in days" :key="date || index"
        ><UButton
          v-if="date"
          :disabled="loading || busy || !availableDates.has(date)"
          :variant="selectedDate === date ? 'solid' : 'outline'"
          :aria-label="date"
          :aria-pressed="selectedDate === date"
          class="justify-center"
          @click="selectedDate = date"
          >{{ Number(date.slice(-2)) }}</UButton
        ><span v-else
      /></template>
    </div>
    <p v-if="!loading && !daySlots.length" role="status">{{ t('planning.noAvailability') }}</p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <UButton
        v-for="slot in daySlots"
        :key="slot.start + slot.providerUserId"
        variant="outline"
        :disabled="busy || loading"
        class="justify-center"
        @click="choose(slot)"
        >{{
          new Intl.DateTimeFormat(props.locale, {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          }).format(new Date(slot.start))
        }}</UButton
      >
    </div>
    <p class="text-sm text-muted">{{ t('planning.reserveHint') }}</p>
  </div>
</template>
