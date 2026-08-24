<script setup lang="ts">
import { z } from 'zod'
import type {
  ApprovalQueueItemDto,
  InternalApprovalQueueDto
} from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{
  data: InternalApprovalQueueDto
  refresh: () => Promise<unknown>
}>()
const { t, locale } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const busy = ref(false)
const rejectionOpen = ref(false)
const rejectionWeekId = ref('')
const rejectionComment = ref('')
const rejectionState = computed(() => ({ comment: rejectionComment.value }))
const rejectionSchema = computed(() =>
  z.object({
    comment: z.string().trim().min(1, t('features.timesheets.validation.rejectionReason')).max(2000)
  })
)

const formatHours = (minutes: number) => `${(minutes / 60).toFixed(2)} h`
const formatMoney = (minor: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: props.data.settings.currency
  }).format(minor / 100)
const formatEntryMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency
  }).format(minor / 100)
const formatEntryDate = (date: string) =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(new Date(`${date}T12:00:00`))
const projectFor = (projectId: string) => props.data.projects.find((project) => project.id === projectId)
const activityFor = (activityTypeId: string) => props.data.activities.find((activity) => activity.id === activityTypeId)
const weekdayTotals = (item: ApprovalQueueItemDto) => {
  const weekStart = new Date(`${item.weekStartsOn}T12:00:00`)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const value = date.toISOString().slice(0, 10)
    return {
      value,
      label: new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(date),
      minutes: item.entries
        .filter((entry) => entry.entryDate === value)
        .reduce((sum, entry) => sum + entry.durationMinutes, 0)
    }
  })
}

const run = async (operation: () => Promise<unknown>) => {
  busy.value = true
  try {
    await operation()
    await props.refresh()
  } catch (error) {
    toast.add({
      title: t('features.timesheets.messages.saveError'),
      description: String(error),
      color: 'error'
    })
  } finally {
    busy.value = false
  }
}

const review = (id: string, action: 'APPROVE' | 'REOPEN') => run(() => timesheets.reviewWeek(id, action))

const openReject = (id: string) => {
  rejectionWeekId.value = id
  rejectionComment.value = ''
  rejectionOpen.value = true
}

const reject = () =>
  run(async () => {
    await timesheets.reviewWeek(rejectionWeekId.value, 'REJECT', rejectionComment.value)
    rejectionOpen.value = false
  })
</script>

<template>
  <section class="space-y-3">
    <UCard v-if="!data.approvals.length">
      <div class="py-8 text-center">
        <UIcon name="i-lucide-circle-check-big" class="size-8 text-success" />
        <p class="mt-2 font-medium">
          {{ t('features.timesheets.admin.noApprovals') }}
        </p>
      </div>
    </UCard>
    <UCard v-for="item in data.approvals" :key="item.id">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium">{{ item.userName }}</p>
            <UBadge
              :color="item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'error' : 'warning'"
              variant="subtle"
            >
              {{ t(`features.timesheets.status.${item.status.toLowerCase()}`) }}
            </UBadge>
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ item.weekStartsOn }} · {{ formatHours(item.totalMinutes) }} · {{ formatMoney(item.billableAmountMinor) }}
          </p>
          <div v-if="item.clientReviews.length" class="mt-2 flex flex-wrap gap-2">
            <UBadge
              v-for="clientReview in item.clientReviews"
              :key="clientReview.clientOrganizationId"
              :color="clientReview.status === 'DISPUTED' ? 'error' : 'success'"
              variant="subtle"
            >
              {{ data.clients.find((client) => client.organizationId === clientReview.clientOrganizationId)?.name }} ·
              {{ t(`features.timesheets.clientPortal.${clientReview.status.toLowerCase()}`)
              }}<template v-if="clientReview.comment">: {{ clientReview.comment }}</template>
            </UBadge>
          </div>
          <ul class="mt-3 flex max-w-2xl overflow-hidden rounded-md border border-default">
            <li
              v-for="day in weekdayTotals(item)"
              :key="day.value"
              class="flex min-w-0 flex-1 items-baseline justify-center gap-1 border-r border-default px-2 py-2 last:border-r-0"
            >
              <span class="text-xs text-muted">{{ day.label }}</span>
              <span class="text-sm font-semibold" :class="day.minutes ? 'text-highlighted' : 'text-dimmed'">
                {{ formatHours(day.minutes) }}
              </span>
            </li>
          </ul>
        </div>
        <div class="flex flex-wrap gap-2">
          <template v-if="item.status === 'SUBMITTED'">
            <UButton color="error" variant="outline" icon="i-lucide-undo-2" @click="openReject(item.id)">
              {{ t('features.timesheets.admin.reject') }}
            </UButton>
            <UButton color="success" icon="i-lucide-check" :loading="busy" @click="review(item.id, 'APPROVE')">
              {{ t('features.timesheets.admin.approve') }}
            </UButton>
          </template>
          <UButton
            v-else-if="item.status === 'APPROVED'"
            color="neutral"
            variant="outline"
            icon="i-lucide-lock-open"
            @click="review(item.id, 'REOPEN')"
          >
            {{ t('features.timesheets.admin.reopen') }}
          </UButton>
        </div>
      </div>

      <details class="group mt-4 border-t border-default" :open="item.status === 'SUBMITTED'">
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-lucide-list-checks" class="size-4 text-primary" />
            {{ t('features.timesheets.admin.reviewDetails') }}
            <span class="font-normal text-muted">{{
              t('features.timesheets.admin.entryCount', item.entries.length)
            }}</span>
          </span>
          <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>

        <div class="divide-y divide-default border-t border-default">
          <article
            v-for="entry in item.entries"
            :key="entry.id"
            class="grid gap-3 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-start"
          >
            <time :datetime="entry.entryDate" class="text-sm font-medium">
              {{ formatEntryDate(entry.entryDate) }}
            </time>
            <div class="min-w-0">
              <p class="font-medium text-highlighted">
                {{ projectFor(entry.projectId)?.clientName }} · {{ projectFor(entry.projectId)?.name }}
              </p>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span class="text-primary">{{ activityFor(entry.activityTypeId)?.name }}</span>
                <UBadge :color="entry.billable ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ t(entry.billable ? 'features.timesheets.billable' : 'features.timesheets.nonBillable') }}
                </UBadge>
              </div>
              <p class="mt-2 text-sm" :class="entry.note ? 'text-muted' : 'text-dimmed'">
                {{ entry.note || t('features.timesheets.admin.noNote') }}
              </p>
            </div>
            <div class="flex items-baseline gap-1.5 whitespace-nowrap text-sm sm:justify-end sm:text-right">
              <span class="font-semibold text-highlighted">{{ formatHours(entry.durationMinutes) }}</span>
              <span class="text-dimmed">×</span>
              <span class="text-muted">{{ formatEntryMoney(entry.hourlyRateMinor, entry.currency) }}/h</span>
              <span class="text-dimmed">=</span>
              <span class="font-semibold text-highlighted">
                {{ formatEntryMoney(Math.round((entry.durationMinutes * entry.hourlyRateMinor) / 60), entry.currency) }}
              </span>
            </div>
          </article>
        </div>
      </details>
    </UCard>

    <UModal v-model:open="rejectionOpen" :title="t('features.timesheets.admin.rejectTimesheet')">
      <template #body>
        <UForm :state="rejectionState" :schema="rejectionSchema" class="space-y-4" @submit="reject">
          <UFormField name="comment" :label="t('features.timesheets.admin.rejectionReason')" required>
            <UTextarea v-model="rejectionComment" :rows="4" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton type="button" color="neutral" variant="outline" @click="rejectionOpen = false">
              {{ t('features.timesheets.cancel') }}
            </UButton>
            <UButton type="submit" color="error" :loading="busy">
              {{ t('features.timesheets.admin.reject') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </section>
</template>
