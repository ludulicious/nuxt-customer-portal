<script setup lang="ts">
import { formatTimesheetPeriod } from '@nuxt-customer-portal/timesheets/shared/timesheet-dates'
import { addDays, getISOWeek, parseISO } from 'date-fns'

const props = defineProps<{ section: 'myTimesheets' | 'myWeek' | 'internalApprovals' | 'clientApprovals' }>()
const { t, locale } = useI18n()
const { data, pending, error, refresh } = await useTimesheetsDashboard()
interface DashboardCardValue {
  previousSubmissions?: Array<{
    id: string
    weekStartsOn: string
    periodStartsOn: string
    periodEndsOn: string
    status: string
    totalMinutes: number
  }>
  projects: Array<{ id: string; name: string; clientName: string; totalMinutes: number }>
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
const value = computed(
  () =>
    data.value?.[props.section === 'myTimesheets' ? 'myWeek' : props.section] as unknown as
      DashboardCardValue | undefined
)
const minutes = (amount: number) => `${Math.floor(amount / 60)}:${String(amount % 60).padStart(2, '0')}`
const duration = (amount: number) =>
  t(amount === 60 ? 'features.timesheets.dashboard.duration.one' : 'features.timesheets.dashboard.duration.other', {
    value: minutes(amount)
  })
const submissionPeriod = (from: string, to: string) => formatTimesheetPeriod(from, to, locale.value)
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
const title = computed(() => t(`features.timesheets.dashboard.${props.section}.title`))
const icon = computed(
  () =>
    ({
      myTimesheets: 'i-lucide-calendar-check',
      myWeek: 'i-lucide-clock-3',
      internalApprovals: 'i-lucide-stamp',
      clientApprovals: 'i-lucide-building-2'
    })[props.section]
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
        <div class="min-w-0 flex-1">
          <p class="text-3xl font-semibold tabular-nums">{{ duration(value.totalMinutes) }}</p>
          <p class="mt-1 text-sm text-muted">
            {{ weekPeriod(value.weekStartsOn) }}
          </p>
          <ul class="mt-3 space-y-2">
            <li
              v-for="project in value.projects"
              :key="project.id"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <span>{{ project.clientName }} · {{ project.name }}</span>
              <span class="shrink-0 tabular-nums">{{ duration(project.totalMinutes) }}</span>
            </li>
          </ul>
        </div>
        <UButton to="/timesheets" variant="outline" trailing-icon="i-lucide-arrow-right">
          {{ t('features.timesheets.dashboard.open') }}
        </UButton>
      </div>

      <p v-if="value.hasRunningTimer" class="mt-4 text-sm text-primary">
        {{ t('features.timesheets.dashboard.myWeek.timerRunning') }}
      </p>
    </template>

    <template v-else-if="section === 'myTimesheets'">
      <section v-if="value.previousSubmissions?.length">
        <ul class="divide-y divide-default">
          <li v-for="submission in value.previousSubmissions" :key="submission.id">
            <NuxtLink
              :to="{ path: '/timesheets', query: { week: submission.weekStartsOn } }"
              class="flex items-center justify-between gap-3 rounded py-2 hover:bg-elevated"
            >
              <span class="text-sm">{{
                formatTimesheetPeriod(submission.periodStartsOn, submission.periodEndsOn, locale)
              }}</span>
              <span class="flex shrink-0 items-center gap-2">
                <span class="text-sm tabular-nums">{{ duration(submission.totalMinutes) }}</span>
                <UBadge
                  :color="
                    submission.status === 'APPROVED'
                      ? 'success'
                      : submission.status === 'REJECTED'
                        ? 'error'
                        : 'warning'
                  "
                  variant="subtle"
                  >{{ t(`features.timesheets.status.${submission.status.toLowerCase()}`) }}</UBadge
                >
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>
      <p v-else class="text-sm text-muted">{{ t('features.timesheets.dashboard.myTimesheets.empty') }}</p>
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
            ><UBadge
              :color="item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'error' : 'warning'"
              variant="subtle"
              size="sm"
              class="mt-1"
              >{{ t(`features.timesheets.status.${item.status.toLowerCase()}`) }}</UBadge
            ></span
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
            ><span class="block text-muted">{{ item.supplierName }}</span>
            <span class="block text-muted">{{ submissionPeriod(item.periodStartsOn, item.periodEndsOn) }}</span></span
          ><span class="shrink-0 text-right">
            <strong class="block tabular-nums">{{ duration(item.totalMinutes) }}</strong>
            <UBadge
              :color="item.status === 'APPROVED' ? 'success' : item.status === 'DISPUTED' ? 'error' : 'warning'"
              variant="subtle"
              size="sm"
              class="mt-1"
              >{{
                t(
                  item.status === 'PENDING'
                    ? 'features.timesheets.approvals.pending'
                    : `features.timesheets.clientPortal.${item.status.toLowerCase()}`
                )
              }}</UBadge
            >
          </span>
        </li>
      </ul>
    </template>
  </UCard>
</template>
