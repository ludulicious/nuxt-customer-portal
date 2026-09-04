<script setup lang="ts">
import { formatTimesheetPeriod } from '@nuxt-customer-portal/timesheets/shared/timesheet-dates'
import type { DeepReadonly } from 'vue'
import { z } from 'zod'
import type {
  ApprovalQueueItemDto,
  InternalApprovalQueueDto
} from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{
  data: DeepReadonly<InternalApprovalQueueDto>
  refresh: () => Promise<unknown>
  clientMode?: boolean
}>()
const { t, locale } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const busy = ref(false)
const rejectionOpen = ref(false)
const rejectionSubmissionId = ref('')
const rejectionComment = ref('')
const rejectionState = computed(() => ({ comment: rejectionComment.value }))
const rejectionSchema = computed(() =>
  z.object({
    comment: z.string().trim().min(1, t('features.timesheets.validation.rejectionReason')).max(2000)
  })
)

const clientReplyOpen = ref(false)
const clientReplyTarget = ref<{ submissionId: string; clientOrganizationId: string; version: number } | null>(null)
const clientReplyState = reactive({ reply: '' })
const clientReplySchema = z.object({ reply: z.string().trim().min(1).max(5000) })
const openClientReply = (submissionId: string, review: DeepReadonly<ApprovalQueueItemDto['clientReviews'][number]>) => {
  clientReplyTarget.value = { submissionId, clientOrganizationId: review.clientOrganizationId, version: review.version }
  clientReplyState.reply = ''
  clientReplyOpen.value = true
}
const sendClientReply = () =>
  run(async () => {
    const target = clientReplyTarget.value!
    await timesheets.replyClientSubmission(
      target.submissionId,
      target.clientOrganizationId,
      target.version,
      clientReplyState.reply
    )
    clientReplyOpen.value = false
  })

const approvalOpen = ref(false)
const approvalId = ref('')
const approvalState = reactive({ comment: '' })
const approvalSchema = z.object({ comment: z.string().trim().max(2000) })
const openApprove = (id: string) => {
  approvalId.value = id
  approvalState.comment = ''
  approvalOpen.value = true
}
const approve = () =>
  run(async () => {
    await timesheets.reviewSubmission(approvalId.value, 'APPROVE', approvalState.comment)
    approvalOpen.value = false
  })

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
const formatPeriod = (from: string, to: string) => formatTimesheetPeriod(from, to, locale.value)
const projectFor = (projectId: string) => props.data.projects.find((project) => project.id === projectId)
const activityFor = (activityTypeId: string) => props.data.activities.find((activity) => activity.id === activityTypeId)
const weekdayTotals = (item: DeepReadonly<ApprovalQueueItemDto>) => {
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

const requestOpen = ref(false)
const requestTarget = ref<{ submissionId: string; clientOrganizationId: string } | null>(null)
const requestState = reactive({ message: '' })
const requestSchema = z.object({ message: z.string().trim().max(5000) })
const openRequestApproval = (submissionId: string, clientOrganizationId: string) => {
  requestTarget.value = { submissionId, clientOrganizationId }
  requestState.message = ''
  requestOpen.value = true
}
const confirmRequestApproval = () => {
  if (requestTarget.value) {
    return requestApproval(requestTarget.value.submissionId, requestTarget.value.clientOrganizationId)
  }
}
const requestApproval = async (submissionId: string, clientOrganizationId: string) => {
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    await $fetch(`/api/timesheets/submissions/${submissionId}/request-client-approval`, {
      method: 'POST',
      body: { clientOrganizationId, message: requestState.message }
    })
    requestOpen.value = false
    await props.refresh()
  } catch (error) {
    const response = error as { data?: { code?: string; data?: { code?: string } }; statusCode?: number }
    const code = response.data?.data?.code ?? response.data?.code
    const reasons: Record<string, string> = {
      CLIENT_APPROVAL_NOT_READY: 'notReady',
      CLIENT_APPROVAL_ACCESS_REQUIRED: 'accessRequired',
      CLIENT_APPROVAL_EMPTY: 'empty',
      CLIENT_APPROVAL_EXISTS: 'exists',
      TIMESHEET_INVOICED: 'invoiced'
    }
    toast.add({
      title: t('features.timesheets.clientSubmissionErrors.title'),
      description: t(
        `features.timesheets.clientSubmissionErrors.${reasons[code ?? ''] ?? (response.statusCode === 403 ? 'unauthorized' : 'generic')}`
      ),
      color: 'error'
    })
  } finally {
    busy.value = false
  }
}
const review = (id: string, action: 'APPROVE' | 'REOPEN') => run(() => timesheets.reviewSubmission(id, action))

const openReject = (id: string) => {
  rejectionSubmissionId.value = id
  rejectionComment.value = ''
  rejectionOpen.value = true
}

const reject = () =>
  run(async () => {
    await timesheets.reviewSubmission(rejectionSubmissionId.value, 'REJECT', rejectionComment.value)
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
    <details
      v-for="item in data.approvals"
      :key="clientMode ? item.id + item.clientReviews[0]?.clientOrganizationId : item.id"
      :open="item.status === 'SUBMITTED' || item.clientReviews.some((review) => review.status === 'DISPUTED')"
      class="group rounded-lg border border-default bg-default"
    >
      <summary
        class="relative cursor-pointer list-none rounded-lg p-4 pr-12 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium">
                <template v-if="clientMode"
                  >{{
                    data.clients.find((client) => client.organizationId === item.clientReviews[0]?.clientOrganizationId)
                      ?.name
                  }}
                  · </template
                >{{ item.userName }}
              </p>
              <UBadge
                v-if="!clientMode"
                :color="item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'error' : 'warning'"
                variant="subtle"
              >
                {{ t(`features.timesheets.status.${item.status.toLowerCase()}`) }}
              </UBadge>
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ formatPeriod(item.periodStartsOn, item.periodEndsOn) }} · {{ formatHours(item.totalMinutes) }} ·
              {{ formatMoney(item.billableAmountMinor) }}
            </p>
            <div v-if="item.clientReviews.length" class="mt-2 flex flex-wrap gap-2">
              <UBadge
                v-for="clientReview in item.clientReviews"
                :key="clientReview.clientOrganizationId"
                :color="
                  clientReview.status === 'DISPUTED'
                    ? 'error'
                    : ['APPROVED', 'AUTO_APPROVED'].includes(clientReview.status)
                      ? 'success'
                      : 'warning'
                "
                variant="subtle"
              >
                <template v-if="!clientMode">
                  {{ data.clients.find((client) => client.organizationId === clientReview.clientOrganizationId)?.name }}
                  ·
                </template>
                {{ t(`features.timesheets.clientPortal.${clientReview.status.toLowerCase()}`) }}
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
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="!clientMode && item.status === 'SUBMITTED'">
              <UButton color="error" variant="outline" icon="i-lucide-undo-2" @click.stop.prevent="openReject(item.id)">
                {{ t('features.timesheets.admin.reject') }}
              </UButton>
              <UButton color="success" icon="i-lucide-check" :loading="busy" @click.stop.prevent="openApprove(item.id)">
                {{ t('features.timesheets.admin.approve') }}
              </UButton>
            </template>
            <UButton
              v-else-if="!clientMode && item.status === 'APPROVED'"
              color="neutral"
              variant="outline"
              icon="i-lucide-lock-open"
              @click.stop.prevent="review(item.id, 'REOPEN')"
            >
              {{ t('features.timesheets.admin.reopen') }}
            </UButton>
            <UIcon
              name="i-lucide-chevron-down"
              class="absolute top-4 right-4 size-4 text-muted transition-transform group-open:rotate-180"
            />
          </div>
        </div>
      </summary>
      <div class="px-4 pb-4">
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
              <p v-if="entry.note?.trim()" class="mt-2 whitespace-pre-line text-sm text-muted">
                {{ entry.note }}
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
        <TimesheetsSubmissionTimeline :events="item.history ?? []" />
        <section
          v-if="
            item.clientReviews.length &&
            (!clientMode ||
              item.clientReviews.some(
                (decision) =>
                  decision.status === 'AUTO_APPROVED' || (decision.canReply && decision.status === 'DISPUTED')
              ))
          "
          :class="clientMode ? 'mt-4 flex justify-end gap-3' : 'mt-4 space-y-3 border-t border-default pt-4'"
        >
          <h3 v-if="!clientMode" class="font-semibold">{{ t('features.timesheets.admin.clientApprovals') }}</h3>
          <div
            v-for="clientDecision in item.clientReviews"
            :key="clientDecision.clientOrganizationId"
            :class="clientMode ? 'flex justify-end gap-3' : 'rounded-md border border-default p-3'"
          >
            <div v-if="!clientMode" class="flex flex-wrap items-center justify-between gap-3">
              <span class="font-medium">{{
                data.clients.find((client) => client.organizationId === clientDecision.clientOrganizationId)?.name
              }}</span>
              <UBadge
                :color="
                  clientDecision.status === 'DISPUTED'
                    ? 'error'
                    : ['APPROVED', 'AUTO_APPROVED'].includes(clientDecision.status)
                      ? 'success'
                      : 'warning'
                "
                variant="subtle"
              >
                {{ t(`features.timesheets.clientPortal.${clientDecision.status.toLowerCase()}`) }}
              </UBadge>
            </div>
            <p v-if="!clientMode && clientDecision.comment" class="mt-2 whitespace-pre-line text-sm text-muted">
              {{ clientDecision.comment }}
            </p>
            <UButton
              v-if="clientMode && clientDecision.status === 'AUTO_APPROVED'"
              class="mt-3"
              :loading="busy"
              icon="i-lucide-send"
              @click="openRequestApproval(item.id, clientDecision.clientOrganizationId)"
            >
              {{ t('features.timesheets.submissions.title') }}
            </UButton>
            <UButton
              v-if="clientDecision.canReply && clientDecision.status === 'DISPUTED'"
              class="mt-3"
              icon="i-lucide-reply"
              @click="openClientReply(item.id, clientDecision)"
            >
              {{ t('features.timesheets.submissions.resubmit') }}
            </UButton>
          </div>
        </section>
      </div>
    </details>

    <UModal v-model:open="requestOpen" :title="t('features.timesheets.submissions.title')">
      <template #body>
        <UForm
          :schema="requestSchema"
          :state="requestState"
          novalidate
          class="space-y-4"
          @submit="confirmRequestApproval"
        >
          <UFormField name="message" :label="t('features.timesheets.submissions.remark')">
            <UTextarea v-model="requestState.message" :rows="4" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" :disabled="busy" @click="requestOpen = false">{{
              t('features.timesheets.cancel')
            }}</UButton>
            <UButton type="submit" icon="i-lucide-send" :loading="busy">{{
              t('features.timesheets.submissions.title')
            }}</UButton>
          </div>
        </UForm>
      </template>
    </UModal>
    <UModal v-model:open="clientReplyOpen" :title="t('features.timesheets.submissions.reply')">
      <template #body>
        <UForm
          :schema="clientReplySchema"
          :state="clientReplyState"
          novalidate
          class="space-y-4"
          @submit="sendClientReply"
        >
          <UFormField name="reply" :label="t('features.timesheets.submissions.reply')">
            <UTextarea v-model="clientReplyState.reply" class="w-full" :rows="4" />
          </UFormField>
          <UButton type="submit" :loading="busy">{{ t('features.timesheets.submissions.resubmit') }}</UButton>
        </UForm>
      </template>
    </UModal>
    <UModal v-model:open="approvalOpen" :title="t('features.timesheets.admin.approve')">
      <template #body>
        <UForm :state="approvalState" :schema="approvalSchema" novalidate class="space-y-4" @submit="approve">
          <UFormField name="comment" :label="t('features.timesheets.submissions.remark')">
            <UTextarea v-model="approvalState.comment" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="approvalOpen = false">{{
              t('features.timesheets.cancel')
            }}</UButton>
            <UButton type="submit" color="success" :loading="busy">{{
              t('features.timesheets.admin.approve')
            }}</UButton>
          </div>
        </UForm>
      </template>
    </UModal>
    <UModal v-model:open="rejectionOpen" :title="t('features.timesheets.admin.rejectTimesheet')">
      <template #body>
        <UForm novalidate :state="rejectionState" :schema="rejectionSchema" class="space-y-4" @submit="reject">
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
