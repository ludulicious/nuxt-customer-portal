<script setup lang="ts">
import type { Slot } from '../../shared/types'
import { localParts } from '../../shared/availability'
import type { HoldResult } from '../composables/usePlanning'

const props = defineProps<{
  productId: string
  currency: string
  locale: 'en' | 'nl'
  replacesId?: string
  selectOnly?: boolean
}>()
const emit = defineEmits<{ reserved: [hold: HoldResult]; selected: [slot: Slot, timezone: string] }>()
const api = usePlanning(),
  { t } = useI18n()
const { appointmentTime } = usePlanningTimeDisplay()
const userTimezone = ref('Europe/Amsterdam')
const timezone = ref(userTimezone.value),
  now = new Date(),
  month = ref(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
const selectedDate = ref(''),
  provider = ref('any'),
  slots = ref<Slot[]>([]),
  loading = ref(false),
  busy = ref(false),
  error = ref('')
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
const today = computed(() => localParts(now, timezone.value).date)
function dateState(date: string) {
  if (date < today.value) {
    return 'past'
  }
  if (loading.value) {
    return 'loading'
  }
  return availableDates.value.has(date) ? 'available' : 'unavailable'
}
function dateLabel(date: string) {
  const label = new Intl.DateTimeFormat(props.locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`)
  )
  return `${label}: ${t(`planning.calendarDate.${dateState(date)}`)}`
}
const daySlots = computed(() => {
  const values = filtered.value.filter((s) => localParts(new Date(s.start), timezone.value).date === selectedDate.value)
  // Any-provider mode shows each instant once; the server binds the chosen concrete provider.
  const candidates = provider.value === 'any' ? [...new Map(values.map((s) => [s.start, s])).values()] : values
  let nextStart = -Infinity
  return candidates.filter((slot) => {
    const start = Date.parse(slot.start)
    if (start < nextStart) {
      return false
    }
    nextStart = start + Math.min(Date.parse(slot.end) - start, 30 * 60000)
    return true
  })
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
      if (
        !availableDates.value.has(selectedDate.value) ||
        selectedDate.value.slice(0, 7) !== month.value.toISOString().slice(0, 7)
      ) {
        selectedDate.value = ''
      }
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
  if (props.selectOnly) {
    emit('selected', slot, timezone.value)
    return
  }
  busy.value = true
  error.value = ''
  try {
    const previousHoldToken = sessionStorage.getItem(`planning-hold:${props.productId}`) || undefined
    const reservedHold = await api.reserve({
      productId: props.productId,
      providerUserId: slot.providerUserId,
      start: slot.start,
      customerTimezone: timezone.value,
      currency: props.currency,
      locale: props.locale,
      replacesId: props.replacesId,
      previousHoldToken
    })
    sessionStorage.setItem(`planning-hold:${props.productId}`, reservedHold.holdToken)
    emit('reserved', reservedHold)
  } catch {
    error.value = t('planning.slotUnavailable')
    await load()
  } finally {
    busy.value = false
  }
}
watch(month, load)
onMounted(() => {
  userTimezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone
  timezone.value = userTimezone.value
  void load()
})
</script>

<template>
  <div class="slot-picker space-y-5" :aria-busy="loading">
    <div v-if="loading" class="availability-loading" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-4 motion-safe:animate-spin" aria-hidden="true" />
      <span>{{ t('planning.loading') }}</span>
    </div>
    <UAlert v-if="error" variant="outline" color="error" :title="error" />
    <div class="grid gap-4" :class="{ 'sm:grid-cols-2': providerOptions.length > 2 }">
      <UFormField :label="t('planning.timezone')"
        ><PlanningTimezoneSelect v-model="timezone" :user-timezone="userTimezone"
      /></UFormField>
      <UFormField v-if="providerOptions.length > 2" :label="t('planning.provider')"
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
    <div class="grid grid-cols-7 gap-1" :aria-label="monthLabel">
      <span v-for="day in weekdays" :key="day" class="text-center text-sm text-muted">{{ day }}</span>
      <template v-for="(date, index) in days" :key="date || index"
        ><UButton
          v-if="date"
          :disabled="loading || busy || dateState(date) !== 'available'"
          variant="ghost"
          :aria-label="dateLabel(date)"
          :title="dateLabel(date)"
          :aria-pressed="selectedDate === date"
          class="calendar-date justify-center"
          :class="[`calendar-date--${dateState(date)}`, { 'calendar-date--selected': selectedDate === date }]"
          @click="selectedDate = date"
          >{{ Number(date.slice(-2)) }}</UButton
        ><span v-else
      /></template>
    </div>
    <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Calendar legend">
      <span class="calendar-key"
        ><span class="calendar-key-dot calendar-key-dot--available" />{{ t('planning.calendarDate.available') }}</span
      >
      <span class="calendar-key"
        ><span class="calendar-key-dot calendar-key-dot--unavailable" />{{
          t('planning.calendarDate.unavailable')
        }}</span
      >
      <span class="calendar-key calendar-key--past"
        ><span class="calendar-key-dot calendar-key-dot--past" />{{ t('planning.calendarDate.past') }}</span
      >
    </div>
    <p v-if="selectedDate && !loading && !daySlots.length" role="status">{{ t('planning.noAvailability') }}</p>
    <p v-if="daySlots.length" class="text-sm text-muted">
      {{ t('planning.slotTimesTimezone', { timezone: timezone.replaceAll('_', ' ') }) }}
    </p>
    <div class="slot-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
      <UButton
        v-for="slot in daySlots"
        :key="slot.start + slot.providerUserId"
        variant="outline"
        :disabled="busy || loading"
        class="justify-center"
        @click="choose(slot)"
        >{{ appointmentTime(slot.start, timezone) }}</UButton
      >
    </div>
    <p class="text-sm text-muted">{{ t('planning.reserveHint') }}</p>
  </div>
</template>

<style scoped>
.slot-picker {
  position: relative;
}
.availability-loading {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  color: var(--checkout-accent, var(--ui-primary));
  background: var(--ui-bg, white);
  box-shadow: 0 2px 10px rgb(0 0 0 / 6%);
  font-size: 0.875rem;
}
.slot-grid {
  min-height: 152px;
  align-content: start;
}
.calendar-date {
  min-height: 42px;
  border-radius: 8px;
  border: 1px solid transparent;
  opacity: 1;
}
.calendar-date--available {
  color: var(--checkout-accent, var(--ui-primary));
  background: color-mix(in srgb, var(--checkout-accent, var(--ui-primary)) 10%, transparent);
  border-color: color-mix(in srgb, var(--checkout-accent, var(--ui-primary)) 35%, transparent);
  font-weight: 600;
}
.calendar-date--available:hover {
  background: color-mix(in srgb, var(--checkout-accent, var(--ui-primary)) 20%, transparent);
}
.calendar-date--selected {
  color: white;
  background: var(--checkout-accent, var(--ui-primary));
  border-color: var(--checkout-accent, var(--ui-primary));
}
.calendar-date--selected:hover {
  background: var(--checkout-accent, var(--ui-primary));
}
.calendar-date--past {
  color: var(--checkout-muted, var(--ui-text-muted));
  opacity: 0.4;
  text-decoration: line-through;
}
.calendar-date--unavailable {
  color: var(--checkout-muted, var(--ui-text-muted));
  background: color-mix(in srgb, var(--checkout-muted, var(--ui-text-muted)) 7%, transparent);
}
.calendar-date--loading {
  color: var(--checkout-muted, var(--ui-text-muted));
  opacity: 0.5;
}
.calendar-key {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--checkout-muted, var(--ui-text-muted));
}
.calendar-key-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  border: 1px solid var(--checkout-border, var(--ui-border));
}
.calendar-key-dot--available {
  background: color-mix(in srgb, var(--checkout-accent, var(--ui-primary)) 10%, transparent);
  border-color: color-mix(in srgb, var(--checkout-accent, var(--ui-primary)) 35%, transparent);
}
.calendar-key-dot--unavailable {
  background: color-mix(in srgb, var(--checkout-muted, var(--ui-text-muted)) 12%, transparent);
}
.calendar-key-dot--past {
  background: linear-gradient(
    135deg,
    transparent 43%,
    var(--checkout-muted, var(--ui-text-muted)) 44% 56%,
    transparent 57%
  );
}
.calendar-key--past {
  opacity: 0.6;
}
</style>
