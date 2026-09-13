<script setup lang="ts">
import type { AvailabilityWindow } from '../../shared/types'
import type { AppointmentListItem } from '../composables/usePlanning'
import { localParts } from '../../shared/availability'

const { appointmentTime } = usePlanningTimeDisplay()
const displayTime = (value: number) => appointmentTime(new Date(Date.UTC(2026, 0, 1, 0, value)), 'UTC')
const props = defineProps<{
  disabled?: boolean
  readonlyTimezone?: boolean
  userTimezone?: string
  days: string[]
  timezone: string
  products: Array<{ id: string; title: string }>
  windows: Array<AvailabilityWindow & { sourceRecurring?: boolean; sourceStart?: string; sourceEnd?: string }>
  appointments: AppointmentListItem[]
}>()
const emit = defineEmits<{
  switchTimezone: []
  select: [date: string, startTime: string, endTime: string]
  edit: [date: string, window: AvailabilityWindow]
  move: [date: string, window: AvailabilityWindow, targetDate: string, startTime: string, endTime: string]
}>()
const { t, locale } = useI18n()
const scroller = ref<HTMLElement>()
const drag = ref<{ date: string; start: number; current: number; pointerId: number }>()
const moving = ref<{
  window: AvailabilityWindow
  date: string
  targetDate: string
  start: number
  end: number
  initialStart: number
  initialEnd: number
  y: number
  x: number
  top: number
  height: number
  mode: 'move' | 'start' | 'end'
  changed: boolean
}>()
function startBlock(
  event: PointerEvent,
  date: string,
  window: AvailabilityWindow,
  mode: 'move' | 'start' | 'end' = 'move'
) {
  if (props.disabled || event.button !== 0) {
    return
  }
  const column = (event.currentTarget as HTMLElement).closest('[data-calendar-date]') as HTMLElement
  const rect = column.getBoundingClientRect()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  moving.value = {
    window,
    date,
    targetDate: date,
    start: minutes(window.startTime),
    end: minutes(window.endTime),
    initialStart: minutes(window.startTime),
    initialEnd: minutes(window.endTime),
    y: event.clientY,
    x: event.clientX,
    top: rect.top,
    height: rect.height,
    mode,
    changed: false
  }
}
function moveBlock(event: PointerEvent) {
  const m = moving.value
  if (!m) {
    return
  }
  if (Math.abs(event.clientY - m.y) + Math.abs(event.clientX - m.x) < 5 && !m.changed) {
    return
  }
  m.changed = true
  const delta = Math.round((((event.clientY - m.y) / m.height) * visibleRange.value.duration) / 15) * 15
  if (m.mode === 'move') {
    const duration = m.initialEnd - m.initialStart
    m.start = Math.max(0, Math.min(1440 - duration, m.initialStart + delta))
    m.end = m.start + duration
    const column = Array.from(scroller.value?.querySelectorAll<HTMLElement>('[data-calendar-date]') || []).find(
      (el) => {
        const r = el.getBoundingClientRect()
        return event.clientX >= r.left && event.clientX < r.right
      }
    )
    m.targetDate = column?.dataset.calendarDate || m.targetDate
  } else if (m.mode === 'start') {
    m.start = Math.max(0, Math.min(m.end - 15, m.initialStart + delta))
  } else {
    m.end = Math.max(m.start + 15, Math.min(1440, m.initialEnd + delta))
  }
}
function finishBlock() {
  if (props.disabled) {
    moving.value = undefined
    return
  }
  const m = moving.value
  moving.value = undefined
  if (!m) {
    return
  }
  if (m.changed) {
    emit('move', m.date, m.window, m.targetDate, time(m.start), time(m.end))
  } else {
    emit('edit', m.date, m.window)
  }
}
const visibleRange = computed(() => {
  const starts = [8 * 60],
    ends = [24 * 60]
  for (const date of props.days) {
    for (const window of windowsFor(date)) {
      starts.push(minutes(window.startTime))
      ends.push(minutes(window.endTime))
    }
    for (const appointment of appointmentsFor(date)) {
      starts.push(appointment.startMinute)
      ends.push(appointment.endMinute)
    }
  }
  const start = Math.floor(Math.min(...starts) / 60) * 60
  const end = Math.min(1440, Math.ceil(Math.max(...ends) / 60) * 60)
  return { start, end, duration: end - start }
})
const hours = computed(() =>
  Array.from({ length: visibleRange.value.duration / 60 }, (_, i) => visibleRange.value.start / 60 + i)
)
const selection = computed(() =>
  drag.value
    ? {
        start: Math.min(drag.value.start, drag.value.current),
        end: Math.min(1440, Math.max(drag.value.start, drag.value.current) + 15)
      }
    : null
)
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const time = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const position = (start: number, end: number) => ({
  top: `${((start - visibleRange.value.start) / visibleRange.value.duration) * 100}%`,
  height: `${(Math.max(15, end - start) / visibleRange.value.duration) * 100}%`
})
function productNames(window: AvailabilityWindow) {
  return window.productIds === null
    ? [t('planning.calendarAllProducts')]
    : window.productIds.map((id) => props.products.find((product) => product.id === id)?.title || t('planning.product'))
}
function windowsFor(date: string) {
  return props.windows.filter(
    (w) =>
      date >= w.date &&
      (!w.endDate || date <= w.endDate) &&
      !w.exceptions.includes(date) &&
      (w.recurring ? new Date(date).getUTCDay() === new Date(w.date).getUTCDay() : date === w.date)
  )
}
function appointmentsFor(date: string) {
  return props.appointments
    .filter((a) => localParts(new Date(a.start), props.timezone).date === date)
    .map((a) => {
      const start = minutes(localParts(new Date(a.start), props.timezone).time)
      const end = localParts(new Date(a.end), props.timezone)
      return { ...a, startMinute: start, endMinute: end.date > date ? 1440 : minutes(end.time) }
    })
}
function point(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return Math.max(
    0,
    Math.min(
      visibleRange.value.end - 15,
      visibleRange.value.start +
        Math.floor((((event.clientY - rect.top) / rect.height) * visibleRange.value.duration) / 15) * 15
    )
  )
}
function startDrag(event: PointerEvent, date: string) {
  if (props.disabled || event.button !== 0) {
    return
  }
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  drag.value = { date, start: point(event), current: point(event), pointerId: event.pointerId }
}
function moveDrag(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) {
    drag.value.current = point(event)
  }
}
function finishDrag(event: PointerEvent) {
  if (!drag.value || drag.value.pointerId !== event.pointerId || !selection.value) {
    return
  }
  const date = drag.value.date,
    { start, end } = selection.value
  drag.value = undefined
  emit('select', date, time(start), time(end))
}
</script>

<template>
  <div class="space-y-3">
    <p class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-mouse-pointer-2" class="size-4 shrink-0" />{{
        t(disabled ? 'planning.calendarReadOnly' : 'planning.dragAvailabilityHelp')
      }}
    </p>
    <div ref="scroller" class="overflow-auto rounded-xl border border-default">
      <div class="min-w-[840px]">
        <div class="sticky top-0 z-20 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-default bg-default">
          <div class="flex items-center justify-center text-xs text-muted">
            <UIcon name="i-lucide-clock" class="size-4" />
          </div>
          <div
            v-for="date in days"
            :key="date"
            class="border-l border-default px-2 py-3 text-center text-sm font-medium"
          >
            {{
              new Intl.DateTimeFormat(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC'
              }).format(new Date(date))
            }}
          </div>
        </div>
        <div class="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div class="relative bg-default" :style="{ height: 'clamp(576px, calc(100dvh - 280px), 1152px)' }">
            <span
              v-for="hour in hours"
              :key="hour"
              class="absolute right-2 text-xs tabular-nums text-muted"
              :style="{ top: `${((hour * 60 - visibleRange.start) / visibleRange.duration) * 100}%` }"
              >{{ displayTime(hour * 60) }}</span
            >
          </div>
          <div
            v-for="date in days"
            :key="date"
            :data-calendar-date="date"
            :style="{ height: 'clamp(576px, calc(100dvh - 280px), 1152px)' }"
            class="relative touch-none select-none border-l border-default"
            :aria-label="t('planning.addWindow') + ' ' + date"
            @pointerdown="startDrag($event, date)"
            @pointermove="moveDrag"
            @pointerup="finishDrag"
            @pointercancel="drag = undefined"
          >
            <div
              v-for="hour in hours"
              :key="hour"
              class="pointer-events-none absolute inset-x-0 border-t border-default"
              :style="{
                top: `${((hour * 60 - visibleRange.start) / visibleRange.duration) * 100}%`,
                height: `${6000 / visibleRange.duration}%`
              }"
            >
              <div class="absolute inset-x-0 top-1/2 border-t border-dashed border-default/50" />
            </div>
            <PlanningTimezoneReadOnlyHover
              v-for="window in windowsFor(date)"
              :key="window.id"
              :readonly="Boolean(readonlyTimezone)"
              :user-timezone="userTimezone || timezone"
              :start="window.sourceStart"
              :end="window.sourceEnd"
              class="absolute inset-x-1 z-10"
              :style="position(minutes(window.startTime), minutes(window.endTime))"
              @switch-timezone="emit('switchTimezone')"
            >
              <button
                type="button"
                :aria-disabled="disabled"
                class="relative h-full w-full flex cursor-grab touch-none flex-col justify-start overflow-hidden rounded-md border border-primary/30 bg-primary/15 px-2 py-1 text-left text-xs text-primary focus-visible:outline-2 focus-visible:outline-primary"
                :aria-label="`${window.startTime}–${window.endTime} ${t('planning.availability')}`"
                @pointerdown.stop="startBlock($event, date, window)"
                @pointermove.stop="moveBlock"
                @pointerup.stop="finishBlock"
                @pointercancel.stop="moving = undefined"
                @click.stop="!disabled && $event.detail === 0 && emit('edit', date, window)"
              >
                <span
                  class="absolute inset-x-0 top-0 h-2 cursor-ns-resize hover:bg-primary/30"
                  @pointerdown.stop="startBlock($event, date, window, 'start')"
                  @pointermove.stop="moveBlock"
                  @pointerup.stop="finishBlock"
                />
                <span class="block font-semibold tabular-nums"
                  >{{ window.startTime }}–{{ window.endTime }}
                  {{ window.recurring || window.sourceRecurring ? '↻' : '' }}</span
                ><span v-for="(name, index) in productNames(window)" :key="index" class="block break-words">{{
                  name
                }}</span>
                <span
                  class="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize hover:bg-primary/30"
                  @pointerdown.stop="startBlock($event, date, window, 'end')"
                  @pointermove.stop="moveBlock"
                  @pointerup.stop="finishBlock"
                />
              </button>
            </PlanningTimezoneReadOnlyHover>
            <PlanningTimezoneReadOnlyHover
              v-for="appointment in appointmentsFor(date)"
              :key="appointment.id"
              :readonly="Boolean(readonlyTimezone)"
              :user-timezone="userTimezone || timezone"
              :start="appointment.start"
              :end="appointment.end"
              class="absolute inset-x-1 z-10"
              :style="position(appointment.startMinute, appointment.endMinute)"
              @switch-timezone="emit('switchTimezone')"
            >
              <NuxtLink
                :to="`/appointments/${appointment.id}`"
                class="block h-full w-full overflow-hidden rounded-md border border-default bg-elevated px-2 py-1 text-xs"
                @pointerdown.stop
                ><span class="block font-semibold">{{ appointment.title }}</span
                ><span v-if="appointment.conflict" class="text-error">{{ t('planning.conflict') }}</span></NuxtLink
              >
            </PlanningTimezoneReadOnlyHover>
            <div
              v-if="moving?.targetDate === date"
              class="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-primary bg-default px-2 py-1 text-xs font-semibold text-primary"
              :style="position(moving.start, moving.end)"
            >
              {{ displayTime(moving.start) }}–{{ displayTime(moving.end) }}
            </div>
            <div
              v-if="drag?.date === date && selection"
              class="pointer-events-none absolute inset-x-1 z-10 rounded-md border border-primary bg-primary/25 px-2 py-1 text-xs font-semibold text-primary"
              :style="position(selection.start, selection.end)"
            >
              {{ displayTime(selection.start) }}–{{ displayTime(selection.end) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
