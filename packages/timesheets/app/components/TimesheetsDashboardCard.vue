<script setup lang="ts">
import { addDays, getISOWeek, parseISO } from 'date-fns'

const props = defineProps<{ section: 'myWeek' | 'internalApprovals' | 'clientApprovals' }>()
const { t, locale } = useI18n()
const { data, pending, error, refresh } = await useTimesheetsDashboard()
interface DashboardCardValue {
  weekStartsOn: string
  status: string
  totalMinutes: number
  rejectionComment: string | null
  hasRunningTimer: boolean
  batches: Array<{
    id: string
    status: string
    totalMinutes: number
    periodStartsOn: string
    periodEndsOn: string
  }>
  unsubmitted: { totalMinutes: number; periodStartsOn: string; periodEndsOn: string } | null
  pendingCount: number
  hasHistory: boolean
  unassignedSupplierCount: number
  items: Array<{
    id: string
    userName: string
    weekStartsOn: string
    periodStartsOn: string
    periodEndsOn: string
    totalMinutes: number
    person: string
    supplierName: string
    status: string
  }>
}
const value = computed(() => data.value?.[props.section] as unknown as DashboardCardValue | undefined)
const minutes = (amount: number) => `${Math.floor(amount / 60)}:${String(amount % 60).padStart(2, '0')}`
const duration = (amount: number) =>
  t(amount === 60 ? 'features.timesheets.dashboard.duration.one' : 'features.timesheets.dashboard.duration.other', {
    value: minutes(amount)
  })
const submissionPeriod = (from: string, to: string) => {
  const formatter = new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
  const start = parseISO(from)
  return from === to ? formatter.format(start) : formatter.formatRange(start, parseISO(to))
}
const weekPeriod = (weekStartsOn: string) => {
  const start = parseISO(weekStartsOn)
  const end = addDays(start, 6)
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  }).format(start)
  const endLabel = new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(end)
  return t('features.timesheets.dashboard.myWeek.period', {
    week: getISOWeek(start),
    start: startLabel,
    end: endLabel
  })
}
const compactPeriod = (from: string, to: string) => {
  const start = parseISO(from)
  const end = parseISO(to)
  const formatter = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' })
  return from === to
    ? formatter.format(start)
    : t('features.timesheets.dashboard.myWeek.compactPeriod', {
        start: formatter.format(start),
        end: formatter.format(end)
      })
}
const title = computed(() => t(`features.timesheets.dashboard.${props.section}.title`))
const icon = computed(
  () =>
    ({ myWeek: 'i-lucide-clock-3', internalApprovals: 'i-lucide-stamp', clientApprovals: 'i-lucide-building-2' })[
      props.section
    ]
)
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ title }}</h2>
        <UIcon :name="icon" class="size-5 text-primary" />
      </div>
    </template>

    <div v-if="pending" class="space-y-3" aria-live="polite">
      <USkeleton class="h-8 w-24" /><USkeleton class="h-4 w-full" /><USkeleton class="h-4 w-2/3" />
    </div>
    <div v-else-if="error" class="py-3 text-center">
      <p class="text-sm text-muted">{{ t('features.timesheets.dashboard.error') }}</p>
      <UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" @click="refresh()">
        {{ t('features.timesheets.dashboard.retry') }}
      </UButton>
    </div>
    <div v-else-if="!value" class="py-4 text-center text-sm text-muted">
      {{ t('features.timesheets.dashboard.unavailable') }}
    </div>

    <template v-else-if="section === 'myWeek'">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-3xl font-semibold tabular-nums">{{ duration(value.totalMinutes) }}</p>
          <p class="mt-1 text-sm text-muted">
            {{ weekPeriod(value.weekStartsOn) }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <UBadge
              v-for="batch in value.batches"
              :key="batch.id"
              :color="batch.status === 'APPROVED' ? 'success' : batch.status === 'REJECTED' ? 'error' : 'warning'"
              variant="subtle"
            >
              {{ t(`features.timesheets.status.${batch.status.toLowerCase()}`) }}: {{ duration(batch.totalMinutes) }} ·
              {{ compactPeriod(batch.periodStartsOn, batch.periodEndsOn) }}
            </UBadge>
            <UBadge v-if="value.unsubmitted" color="neutral" variant="subtle">
              {{ t('features.timesheets.submissions.none') }}: {{ duration(value.unsubmitted.totalMinutes) }} ·
              {{ compactPeriod(value.unsubmitted.periodStartsOn, value.unsubmitted.periodEndsOn) }}
            </UBadge>
          </div>
        </div>
        <UButton to="/timesheets" variant="outline" trailing-icon="i-lucide-arrow-right">
          {{ t('features.timesheets.dashboard.open') }}
        </UButton>
      </div>
      <UAlert
        v-if="value.rejectionComment"
        class="mt-4"
        color="error"
        variant="subtle"
        icon="i-lucide-message-circle-warning"
        :title="t('features.timesheets.dashboard.myWeek.rejected')"
        :description="value.rejectionComment"
      />
      <p v-else-if="value.hasRunningTimer" class="mt-4 text-sm text-primary">
        {{ t('features.timesheets.dashboard.myWeek.timerRunning') }}
      </p>
    </template>

    <template v-else-if="section === 'internalApprovals'">
      <div class="flex items-center justify-between">
        <p class="text-3xl font-semibold tabular-nums">{{ value.pendingCount }}</p>
        <UButton
          v-if="value.pendingCount > 0 || value.items.length > 0"
          :to="
            value.pendingCount > 0
              ? '/timesheets/internal-approvals?status=SUBMITTED'
              : '/timesheets/internal-approvals'
          "
          variant="outline"
        >
          {{
            t(value.pendingCount > 0 ? 'features.timesheets.dashboard.review' : 'features.timesheets.dashboard.viewAll')
          }}
        </UButton>
      </div>
      <p v-if="!value.items.length" class="mt-4 text-sm text-muted">
        {{ t('features.timesheets.dashboard.internalApprovals.empty') }}
      </p>
      <ul v-else class="mt-4 divide-y divide-default">
        <li v-for="item in value.items" :key="item.id" class="flex items-center justify-between gap-3 py-2 text-sm">
          <span class="truncate"
            ><strong>{{ item.userName }}</strong
            ><span class="block text-muted">{{ submissionPeriod(item.periodStartsOn, item.periodEndsOn) }}</span></span
          ><span class="shrink-0 text-right"
            ><strong class="block tabular-nums">{{ duration(item.totalMinutes) }}</strong
            ><span class="text-xs text-muted">{{
              t(`features.timesheets.status.${item.status.toLowerCase()}`)
            }}</span></span
          >
        </li>
      </ul>
    </template>

    <template v-else-if="section === 'clientApprovals'">
      <div class="flex items-center justify-between">
        <p class="text-3xl font-semibold tabular-nums">{{ value.pendingCount }}</p>
        <UButton
          v-if="value.pendingCount > 0 || value.hasHistory"
          :to="value.pendingCount > 0 ? '/timesheets/approvals?status=PENDING' : '/timesheets/approvals'"
          variant="outline"
        >
          {{
            t(value.pendingCount > 0 ? 'features.timesheets.dashboard.review' : 'features.timesheets.dashboard.viewAll')
          }}
        </UButton>
      </div>
      <UAlert
        v-if="value.unassignedSupplierCount"
        class="mt-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-user-round-x"
        :description="t('features.timesheets.dashboard.clientApprovals.noReviewer')"
      />
      <p v-if="!value.items.length" class="mt-4 text-sm text-muted">
        {{ t('features.timesheets.dashboard.clientApprovals.empty') }}
      </p>
      <ul v-else class="mt-4 divide-y divide-default">
        <li v-for="item in value.items" :key="item.id" class="flex justify-between gap-3 py-2 text-sm">
          <span class="truncate"
            ><strong>{{ item.person }}</strong
            ><span class="block text-muted">{{ item.supplierName }}</span></span
          ><span class="shrink-0 text-muted">{{ duration(item.totalMinutes) }}</span>
        </li>
      </ul>
    </template>
  </UCard>
</template>
