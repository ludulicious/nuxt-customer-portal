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
  docked?: boolean
}>()
const emit = defineEmits<{ reserved: [hold: HoldResult]; selected: [slot: Slot, timezone: string] }>()
const api = usePlanning(),
  { t } = useI18n()
const { appointmentTime, appointmentRange } = usePlanningTimeDisplay()
const selectedSlot = ref<Slot>()
const timesOpen = ref(false)
const timesHeading = useTemplateRef('timesHeading')
async function chooseDate(date: string) {
  selectedDate.value = date
  timesOpen.value = true
  await nextTick()
  timesHeading.value?.focus({ preventScroll: true })
}
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
  return candidates
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
function choose(slot: Slot) {
  if (props.selectOnly) {
    emit('selected', slot, timezone.value)
    return
  }
  selectedSlot.value = slot
  error.value = ''
}
async function confirmTime() {
  const slot = selectedSlot.value
  if (!slot || busy.value || loading.value) {
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
    selectedSlot.value = undefined
    error.value = t('planning.slotUnavailable')
    await load()
  } finally {
    busy.value = false
  }
}
watch(month, load)
watch([timezone, provider, () => props.currency], () => {
  selectedSlot.value = undefined
})
onMounted(() => {
  userTimezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone
  timezone.value = userTimezone.value
  void load()
})
</script>

<template>
  <div
    class="slot-picker space-y-5"
    :class="{ 'slot-picker--docked': docked, 'slot-picker--times': timesOpen }"
    :aria-busy="loading"
  >
    <div v-if="loading" class="availability-loading" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-4 motion-safe:animate-spin" aria-hidden="true" />
      <span>{{ t('planning.loading') }}</span>
    </div>
    <UAlert v-if="error" variant="outline" color="error" :title="error" />
    <div class="slot-workspace">
      <div class="calendar-content">
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
              @click="chooseDate(date)"
              >{{ Number(date.slice(-2)) }}</UButton
            ><span v-else
          /></template>
        </div>
        <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Calendar legend">
          <span class="calendar-key"
            ><span class="calendar-key-dot calendar-key-dot--available" />{{
              t('planning.calendarDate.available')
            }}</span
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
        <div class="booking-selectors">
          <UFormField v-if="providerOptions.length > 1" class="border-label-field" :label="t('planning.provider')"
            ><USelect v-model="provider" :items="providerOptions" class="w-full"
          /></UFormField>
          <UFormField class="border-label-field booking-timezone" :label="t('planning.timezone')"
            ><PlanningTimezoneSelect v-model="timezone" :user-timezone="userTimezone" class="w-full"
          /></UFormField>
        </div>
      </div>
      <Transition name="times-slide">
        <section v-if="selectedDate" class="times-panel" :aria-label="t('planning.chooseAppointmentTime')">
          <div class="mobile-times-heading">
            <UButton
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="soft"
              size="lg"
              class="change-date-button min-h-11"
              :disabled="busy"
              @click="timesOpen = false"
              >{{ t('planning.changeDate') }}</UButton
            >
            <h3 ref="timesHeading" tabindex="-1">
              {{
                new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
                  new Date(`${selectedDate}T12:00:00Z`)
                )
              }}
            </h3>
          </div>
          <p v-if="selectedDate && !loading && !daySlots.length" role="status">{{ t('planning.noAvailability') }}</p>
          <p v-if="daySlots.length" class="text-sm text-muted">
            {{ t('planning.slotTimesTimezone', { timezone: timezone.replaceAll('_', ' ') }) }}
          </p>
          <div class="slot-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
            <UButton
              v-for="slot in daySlots"
              :key="slot.start + slot.providerUserId"
              :variant="
                selectedSlot?.start === slot.start && selectedSlot?.providerUserId === slot.providerUserId
                  ? 'solid'
                  : 'outline'
              "
              :aria-pressed="selectedSlot?.start === slot.start && selectedSlot?.providerUserId === slot.providerUserId"
              :disabled="busy || loading"
              class="justify-center"
              @click="choose(slot)"
              >{{ appointmentTime(slot.start, timezone) }}</UButton
            >
          </div>
        </section>
      </Transition>
    </div>
    <div v-if="!selectOnly" class="time-confirmation" :class="{ 'time-confirmation--docked': docked }">
      <div class="time-confirmation-inner">
        <div v-if="selectedSlot" class="selected-time-summary" role="status">
          <UIcon name="i-lucide-calendar-check" class="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p class="font-semibold">{{ appointmentRange(selectedSlot.start, selectedSlot.end, timezone) }}</p>
            <p class="text-sm text-muted">{{ selectedSlot.providerName }} · {{ timezone.replaceAll('_', ' ') }}</p>
          </div>
        </div>
        <div v-else class="time-selection-placeholder" aria-hidden="true" />
        <UButton
          class="w-full justify-center"
          size="lg"
          :variant="selectedSlot ? 'solid' : 'outline'"
          icon="i-lucide-arrow-right"
          :disabled="!selectedSlot || loading || busy"
          :loading="busy"
          @click="confirmTime"
          >{{ t('planning.continueToCheckout') }}</UButton
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.slot-picker {
  position: relative;
}
.booking-selectors {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding-top: 8px;
}
.booking-timezone {
  grid-column: 2;
}
.border-label-field {
  position: relative;
}
.border-label-field :deep(label) {
  position: absolute;
  top: -8px;
  left: 12px;
  z-index: 1;
  padding-inline: 5px;
  background: var(--booking-field-background, var(--checkout-paper, var(--ui-bg)));
  color: var(--checkout-muted, var(--ui-text-muted));
  font-size: 0.75rem;
  line-height: 16px;
}
.border-label-field :deep(button[role='combobox']),
.border-label-field :deep(select) {
  height: 32px;
  min-height: 32px;
}
.calendar-content {
  display: contents;
}
.slot-workspace {
  display: contents;
}
.mobile-times-heading {
  display: none;
}
.change-date-button {
  border-radius: 8px;
  background: color-mix(in srgb, var(--checkout-display, var(--ui-text)) 9%, var(--checkout-surface, var(--ui-bg)));
  color: var(--checkout-display, var(--ui-text));
  font-weight: 600;
}
.change-date-button:hover {
  background: color-mix(in srgb, var(--checkout-display, var(--ui-text)) 15%, var(--checkout-surface, var(--ui-bg)));
}
.times-panel {
  display: grid;
  gap: 12px;
}
.time-confirmation-inner {
  display: grid;
  gap: 12px;
}
.slot-picker--docked {
  padding-bottom: 0;
}
.slot-picker--docked .slot-workspace {
  display: grid;
}
.slot-picker--docked .calendar-content {
  display: grid;
  gap: 12px;
  grid-area: 1 / 1;
}
.slot-picker--docked.slot-picker--times .calendar-content {
  visibility: hidden;
  pointer-events: none;
}
.slot-picker--docked:not(.slot-picker--times) .times-panel {
  display: none;
}
.slot-picker--docked .mobile-times-heading {
  display: grid;
  justify-items: start;
  gap: 12px;
}
.slot-picker--docked .times-panel {
  grid-area: 1 / 1;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  align-content: start;
  animation: times-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.time-confirmation--docked {
  position: sticky;
  bottom: 0;
  z-index: 40;
  margin: 0;
  padding: 16px max(16px, env(safe-area-inset-left)) calc(16px + env(safe-area-inset-bottom));
  background: var(--checkout-surface, var(--ui-bg));
  color: var(--checkout-display, var(--ui-text));
  border-top: 1px solid var(--checkout-border, var(--ui-border));
}
.time-confirmation--docked .time-confirmation-inner {
  width: min(1120px, 100%);
  margin-inline: auto;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.time-confirmation--docked button {
  width: 100%;
  white-space: nowrap;
  min-height: 44px;
}
.time-confirmation--docked .selected-time-summary,
.time-confirmation--docked .time-selection-placeholder {
  min-height: 48px;
}
@media (max-width: 960px) {
  .slot-picker--docked {
    padding-bottom: calc(200px + env(safe-area-inset-bottom));
  }
  .time-confirmation--docked {
    position: fixed;
    inset: auto 0 0;
  }
  .slot-picker--docked .calendar-content {
    display: grid;
    gap: 8px;
  }
  .slot-picker--docked:not(.slot-picker--times) .times-panel {
    display: none;
  }
  .slot-picker--docked .mobile-times-heading {
    display: grid;
    justify-items: start;
    gap: 12px;
  }
  .slot-picker--docked .times-panel {
    animation: times-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .time-confirmation--docked .time-confirmation-inner {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .time-confirmation--docked button {
    width: 100%;
  }
  .time-confirmation--docked .selected-time-summary {
    font-size: 0.9rem;
  }
  .slot-picker--docked .calendar-date {
    min-height: 44px;
  }
  .slot-picker--docked .slot-grid button {
    min-height: 44px;
  }
}
@keyframes times-in {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .slot-picker--docked .times-panel {
    animation: none;
  }
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
.time-confirmation {
  display: grid;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--checkout-border, var(--ui-border));
}
.selected-time-summary {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--checkout-display, var(--ui-text));
}
.selected-time-summary > span {
  color: var(--checkout-accent, var(--ui-primary));
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
