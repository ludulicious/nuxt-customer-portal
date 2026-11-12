<script setup lang="ts">
import { z } from 'zod'
import { reviewPeriodIncludesMonth, shiftReviewMonth } from '../../shared/client-review-month'
import type { ClientReviewPeriodDto, ClientReviewRequestDto } from '../../shared/types/client-review-request'

const props = defineProps<{ clientSide?: boolean }>()
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
// Keep request controls separate from the historical list's query parameters.
const queryControl = (key: string, fallback: string, valid: (value: string) => boolean = () => true) =>
  computed({
    get: () => {
      const value = route.query[key]
      return typeof value === 'string' && valid(value) ? value : fallback
    },
    set: (value: string) => {
      void router.replace({
        query: { ...route.query, requestPage: undefined, [key]: value === fallback ? undefined : value }
      })
    }
  })
const toast = useToast()
const prefix = 'features.timesheets.reviewPeriods.'
const statusColors = {
  PENDING: 'warning',
  APPROVED: 'success',
  AUTO_APPROVED: 'success',
  DISPUTED: 'error',
  WITHDRAWN: 'neutral'
} as const
const endpoint = computed(() => `/api/timesheets/${props.clientSide ? 'client' : 'admin'}/review-requests`)
const {
  data: requests,
  error,
  refresh
} = await useFetch<ClientReviewRequestDto[], import('#app').NuxtError<unknown>, string>(endpoint)
const month = queryControl(
  'reviewMonth',
  shiftReviewMonth(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(0, 7), -1),
  (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
)
const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month.value}-01T00:00:00Z`)
  )
)
const requestsForMonth = computed(() =>
  props.clientSide
    ? (requests.value ?? [])
    : (requests.value ?? []).filter((request) => reviewPeriodIncludesMonth(request, month.value))
)
const search = queryControl('requestSearch', '')
const status = queryControl('requestStatus', 'ALL', (value) =>
  ['ALL', 'PENDING', 'APPROVED', 'DISPUTED', 'WITHDRAWN', 'AUTO_APPROVED'].includes(value)
)
const pageQuery = queryControl('requestPage', '1', (value) => /^[1-9]\d*$/.test(value))
const page = computed({
  get: () => Math.min(Number(pageQuery.value), Math.max(1, Math.ceil(filtered.value.length / 10))),
  set: (value: number) => {
    pageQuery.value = String(value)
  }
})
const periods = ref<ClientReviewPeriodDto[]>([])
const emptyQuery = queryControl('emptyPeriods', '')
const showEmpty = computed({
  get: () => emptyQuery.value === 'true',
  set: (value: boolean) => {
    emptyQuery.value = value ? 'true' : ''
  }
})
const periodsPending = ref(false)
const periodsError = ref(false)
let periodLoad = 0
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00Z`))
const visiblePeriods = computed(() =>
  periods.value
    .filter((period) => showEmpty.value || period.availableCount > 0 || period.outstandingCount > 0)
    .toSorted(
      (a, b) =>
        Number(b.canSend) - Number(a.canSend) ||
        a.clientName.localeCompare(b.clientName) ||
        a.startsOn.localeCompare(b.startsOn)
    )
)
const readyCount = computed(() => periods.value.filter((period) => period.canSend).length)
const periodStatus = (period: ClientReviewPeriodDto) =>
  period.canSend ? 'ready' : !period.availableCount && !period.outstandingCount ? 'emptyPeriod' : 'needsAttention'
const sortBy = queryControl('requestSort', 'startsOn', (value) => ['startsOn', 'clientName'].includes(value))
const directionQuery = queryControl('requestDirection', 'desc', (value) => ['asc', 'desc'].includes(value))
const sortDir = computed<'asc' | 'desc'>({
  get: () => (directionQuery.value === 'asc' ? 'asc' : 'desc'),
  set: (value) => {
    directionQuery.value = value
  }
})
const requestFilters = computed(() => [
  {
    key: 'status',
    placeholder: t(prefix + 'status'),
    items: [
      { label: t('features.timesheets.approvals.allStatuses'), value: undefined },
      ...['PENDING', 'APPROVED', 'DISPUTED', 'WITHDRAWN', ...(!props.clientSide ? ['AUTO_APPROVED'] : [])].map(
        (value) => ({
          value,
          label: t(prefix + 'statuses.' + value)
        })
      )
    ]
  }
])
const sortOptions = computed(() => [
  { value: 'startsOn', label: t(prefix + 'period') },
  { value: 'clientName', label: t(prefix + 'client') }
])
const busy = ref(false)
const affectedRequests = ref<Array<{ id: string; clientName: string; startsOn: string; endsOn: string }>>([])
const loadPeriods = async () => {
  if (props.clientSide) {
    return
  }
  const load = ++periodLoad
  periodsPending.value = true
  periodsError.value = false
  try {
    const result = await $fetch<{ periods: ClientReviewPeriodDto[]; startsOn: string }, string>(
      '/api/timesheets/admin/review-periods',
      { query: { month: month.value } }
    )
    if (load === periodLoad) {
      periods.value = result.periods
    }
  } catch {
    if (load === periodLoad) {
      periodsError.value = true
    }
  } finally {
    if (load === periodLoad) {
      periodsPending.value = false
    }
  }
}
await loadPeriods()
watch(month, loadPeriods)
const filtered = computed(() =>
  requestsForMonth.value
    .filter(
      (r) =>
        (status.value === 'ALL' || r.status === status.value) &&
        `${r.clientName} ${r.supplierName} ${r.startsOn} ${r.endsOn}`.toLowerCase().includes(search.value.toLowerCase())
    )
    .toSorted((a, b) => {
      const left = sortBy.value === 'clientName' ? (props.clientSide ? a.supplierName : a.clientName) : a.startsOn
      const right = sortBy.value === 'clientName' ? (props.clientSide ? b.supplierName : b.clientName) : b.startsOn
      return (left.localeCompare(right) || a.id.localeCompare(b.id)) * (sortDir.value === 'asc' ? 1 : -1)
    })
)
const visible = computed(() => filtered.value.slice((page.value - 1) * 10, page.value * 10))
const selected = ref<ClientReviewRequestDto | null>(null)
const selectedPeriod = ref<ClientReviewPeriodDto | null>(null)
const action = ref<'SEND' | 'APPROVE' | 'DISPUTE' | 'WITHDRAW'>('SEND')
const open = ref(false)
const detailsOpen = ref(false)
const state = reactive({ comment: '' })
const schema = computed(() =>
  z.object({ comment: action.value === 'DISPUTE' ? z.string().trim().min(1).max(5000) : z.string().trim().max(5000) })
)
const begin = (
  nextAction: typeof action.value,
  request: ClientReviewRequestDto | null = null,
  period: ClientReviewPeriodDto | null = null
) => {
  action.value = nextAction
  selected.value = request
  selectedPeriod.value = period
  state.comment = ''
  open.value = true
}
const submit = async () => {
  busy.value = true
  try {
    if (action.value === 'SEND' && selectedPeriod.value) {
      await $fetch<unknown, string>('/api/timesheets/admin/review-requests', {
        method: 'POST',
        body: { ...selectedPeriod.value, message: state.comment }
      })
    } else if (selected.value) {
      const url =
        action.value === 'WITHDRAW'
          ? `/api/timesheets/admin/review-requests/${selected.value.id}/withdraw`
          : `/api/timesheets/client/review-requests/${selected.value.id}`
      await $fetch<unknown, string>(url, {
        method: 'POST',
        body: { version: selected.value.version, action: action.value, comment: state.comment }
      })
    }
    open.value = false
    await Promise.all([refresh(), loadPeriods()])
    toast.add({ title: t(prefix + 'saved'), color: 'success' })
  } catch (cause) {
    const failure = cause as { data?: { message?: string } }
    toast.add({ title: t(prefix + 'error'), description: failure.data?.message, color: 'error' })
    await Promise.all([refresh(), loadPeriods()])
  } finally {
    busy.value = false
  }
}
const reopen = async (submissionId: string) => {
  busy.value = true
  try {
    await $fetch<unknown, string>(`/api/timesheets/admin/review-submissions/${submissionId}/reopen`, { method: 'POST' })
    affectedRequests.value = []
    await Promise.all([refresh(), loadPeriods()])
    toast.add({ title: t(prefix + 'reopened'), color: 'success' })
  } catch (cause) {
    const failure = cause as { data?: { message?: string; data?: { requests?: typeof affectedRequests.value } } }
    affectedRequests.value = failure.data?.data?.requests ?? []
    toast.add({ title: t(prefix + 'error'), description: failure.data?.message, color: 'error' })
  } finally {
    busy.value = false
  }
}
const detail = (request: ClientReviewRequestDto) => {
  selected.value = request
  detailsOpen.value = true
}
const grouped = computed(() => {
  const groups = new Map<string, { person: string; project: string; week: string; minutes: number }>()
  for (const entry of selected.value?.entries ?? []) {
    const week = entry.weekStartsOn
    const key = `${entry.personId}/${entry.project}/${week}`
    const group = groups.get(key) ?? { person: entry.person, project: entry.project, week, minutes: 0 }
    group.minutes += entry.minutes
    groups.set(key, group)
  }
  return [...groups.values()]
})
watch(
  [requests, () => route.query.request],
  ([value]) => {
    const id = typeof route.query.request === 'string' ? route.query.request : null
    const request = value?.find((r) => r.id === id)
    if (request) {
      if (!props.clientSide && !reviewPeriodIncludesMonth(request, month.value)) {
        month.value = request.startsOn.slice(0, 7)
      }
      detail(request)
    }
  },
  { immediate: true }
)
</script>

<template>
  <section class="space-y-4">
    <h2 v-if="clientSide" class="text-xl font-semibold">{{ t(prefix + (clientSide ? 'clientTitle' : 'title')) }}</h2>
    <UAlert v-if="error" color="error" :title="t(prefix + 'error')" />
    <UAlert v-if="affectedRequests.length" color="warning" :title="t(prefix + 'withdrawHelp')"
      ><template #description
        ><ul>
          <li v-for="request in affectedRequests" :key="request.id">
            <NuxtLink :to="`/timesheets/client-approvals?request=${request.id}`" class="underline"
              >{{ request.clientName }} · {{ request.startsOn }} – {{ request.endsOn }}</NuxtLink
            >
          </li>
        </ul></template
      ></UAlert
    >
    <div
      v-if="!clientSide"
      class="flex flex-col gap-3 border-b border-default pb-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="min-w-0">
        <h2 class="text-xl font-semibold">{{ monthLabel }}</h2>
        <p class="text-sm text-muted">{{ t(prefix + 'monthHelp') }}</p>
      </div>
      <UFormField :label="t(prefix + 'month')" class="w-full sm:w-80">
        <TimesheetsMonthPicker v-model="month" />
      </UFormField>
    </div>
    <section v-if="!clientSide" class="space-y-3" :aria-label="t(prefix + 'prepareTitle')">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h3 class="text-lg font-semibold">{{ t(prefix + 'prepareTitle') }}</h3>
          <p class="text-sm text-muted">{{ t(prefix + 'prepareHelp') }}</p>
        </div>
        <UCheckbox v-model="showEmpty" :label="t(prefix + 'showEmpty')" />
      </div>
      <p v-if="!periodsPending && !periodsError && readyCount" class="text-sm text-success" aria-live="polite">
        {{ t(prefix + 'readyCount', { count: readyCount }) }}
      </p>
      <div v-if="periodsPending" class="space-y-3" role="status" :aria-label="t(prefix + 'loading')">
        <USkeleton v-for="index in 2" :key="index" class="h-24 w-full" />
      </div>
      <UAlert v-else-if="periodsError" color="error" :title="t(prefix + 'periodsError')">
        <template #actions
          ><UButton variant="outline" color="neutral" @click="loadPeriods">{{ t(prefix + 'retry') }}</UButton></template
        >
      </UAlert>
      <UAlert
        v-else-if="!visiblePeriods.length"
        icon="i-lucide-clock"
        color="neutral"
        variant="outline"
        :title="t(prefix + 'nothingToSend')"
        :description="t(prefix + 'nothingToSendHelp')"
      />
      <div v-else class="space-y-3">
        <UCard
          v-for="period in visiblePeriods"
          :key="`${period.workspaceClientId}/${period.startsOn}`"
          :ui="{ body: 'p-4 sm:p-4' }"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <UAvatar :src="period.clientAvatar || undefined" :alt="period.clientName" size="sm" />
                <h4 class="min-w-0 font-semibold break-words">{{ period.clientName }}</h4>
                <UBadge
                  :color="
                    period.canSend
                      ? 'success'
                      : period.availableCount || period.outstandingCount
                        ? 'warning'
                        : 'neutral'
                  "
                  variant="subtle"
                  >{{ t(prefix + periodStatus(period)) }}</UBadge
                >
              </div>
              <p class="text-sm text-muted">
                {{ dateLabel(period.startsOn) }} – {{ dateLabel(period.endsOn) }} ·
                {{ t(prefix + 'intervals.' + period.interval) }}
              </p>
              <p class="text-sm font-medium">
                {{
                  t(prefix + 'unsentHours', {
                    hours: (period.totalMinutes / 60).toLocaleString(locale, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })
                  })
                }}
              </p>
              <p v-if="period.outstandingCount" class="text-sm text-warning">
                {{ t(prefix + 'outstanding', { count: period.outstandingCount }) }}
              </p>
              <p
                v-if="
                  period.reviewEnabled && !period.hasReviewers && (period.availableCount || period.outstandingCount)
                "
                class="text-sm text-warning"
              >
                {{ t(prefix + 'noReviewers') }}
              </p>
              <p
                v-if="
                  period.reviewEnabled &&
                  period.availableCount &&
                  !period.canSend &&
                  !period.outstandingCount &&
                  period.hasReviewers
                "
                class="text-sm text-muted"
              >
                {{ t(prefix + 'periodOpen') }}
              </p>
              <p v-if="!period.reviewEnabled" class="text-sm text-muted">{{ t(prefix + 'reviewDisabled') }}</p>
              <details v-if="period.outstandingEntries.length" class="pt-1 text-sm">
                <summary class="cursor-pointer text-muted">{{ t(prefix + 'outstandingDetails') }}</summary>
                <ul class="mt-2 space-y-1 text-muted">
                  <li v-for="entry in period.outstandingEntries" :key="entry.id">
                    {{ dateLabel(entry.date) }} · {{ entry.person }}
                  </li>
                </ul>
              </details>
            </div>
            <UButton
              v-if="period.canSend"
              class="shrink-0 self-start whitespace-nowrap"
              :disabled="busy"
              icon="i-lucide-send"
              @click="begin('SEND', null, period)"
              >{{ t(prefix + 'send') }}</UButton
            >
          </div>
        </UCard>
      </div>
    </section>
    <div :class="!clientSide ? 'space-y-2 border-t border-default pt-6' : 'space-y-2'">
      <h3 v-if="!clientSide" class="text-lg font-semibold">{{ t(prefix + 'sentTitle') }}</h3>
      <p v-if="!clientSide" class="text-sm text-muted">{{ t(prefix + 'sentHelp', { month: monthLabel }) }}</p>
    </div>
    <PortalListToolbar
      v-if="requestsForMonth.length"
      v-model:search="search"
      :search-placeholder="t(prefix + 'filter')"
      :filters="requestFilters"
      :filter-values="{ status: status === 'ALL' ? undefined : status }"
      :sort-options="sortOptions"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      @filter="(_key, value) => (status = value || 'ALL')"
      @sort="sortBy = $event"
      @toggle-direction="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
    />
    <UAlert
      v-if="!error && !filtered.length"
      icon="i-lucide-inbox"
      color="neutral"
      variant="outline"
      :title="t(prefix + (requestsForMonth.length ? 'noMatches' : clientSide ? 'empty' : 'monthRequestsEmpty'))"
      :description="
        t(prefix + (requestsForMonth.length ? 'noMatchesHelp' : clientSide ? 'clientEmptyHelp' : 'sentEmptyHelp'))
      "
    />
    <UCard v-for="request in visible" :id="`request-${request.id}`" :key="request.id">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <UAvatar
              :src="(clientSide ? request.supplierAvatar : request.clientAvatar) || undefined"
              :alt="clientSide ? request.supplierName : request.clientName"
              size="sm"
            />
            <h3 class="min-w-0 font-semibold break-words">
              {{ clientSide ? request.supplierName : request.clientName }}
            </h3>
          </div>
          <p>
            {{ dateLabel(request.startsOn) }} – {{ dateLabel(request.endsOn) }}
            <template v-if="!request.legacySubmissionId">
              · {{ t(prefix + 'revision', { number: request.revision }) }}</template
            >
          </p>
          <p>
            {{
              t(prefix + 'hours', { hours: (request.entries.reduce((sum, e) => sum + e.minutes, 0) / 60).toFixed(2) })
            }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UBadge :color="statusColors[request.status]" variant="subtle">{{
            t(prefix + 'statuses.' + request.status)
          }}</UBadge>
          <UBadge v-if="request.supplementary" variant="outline">{{ t(prefix + 'supplementary') }}</UBadge>
          <UBadge v-if="request.replacesId" variant="outline">{{ t(prefix + 'replacement') }}</UBadge>
        </div>
      </div>
      <div v-if="!clientSide && request.status === 'WITHDRAWN'" class="mt-3 flex flex-wrap gap-2">
        <UButton
          v-for="entry in request.entries.filter(
            (entry, index, entries) => entries.findIndex((other) => other.submissionId === entry.submissionId) === index
          )"
          :key="entry.submissionId"
          :disabled="busy"
          variant="outline"
          @click="reopen(entry.submissionId)"
          >{{ t(prefix + 'reopen', { person: entry.person }) }}</UButton
        >
      </div>
      <p v-if="request.message" class="mt-2 whitespace-pre-wrap">{{ request.message }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton variant="outline" @click="detail(request)">{{ t(prefix + 'details') }}</UButton>
        <template v-if="clientSide && request.status === 'PENDING'">
          <UButton @click="begin('APPROVE', request)">{{ t(prefix + 'approve') }}</UButton>
          <UButton color="warning" variant="outline" @click="begin('DISPUTE', request)">{{
            t(prefix + 'dispute')
          }}</UButton>
        </template>
        <UButton
          v-if="!clientSide && !request.legacySubmissionId && request.status !== 'WITHDRAWN'"
          color="warning"
          variant="outline"
          @click="begin('WITHDRAW', request)"
          >{{ t(prefix + 'withdraw') }}</UButton
        >
      </div>
    </UCard>
    <UPagination v-if="filtered.length > 10" v-model:page="page" :total="filtered.length" :items-per-page="10" />
    <TimesheetsTrackingClients v-if="!clientSide" @changed="loadPeriods" />
    <UModal
      v-if="open"
      v-model:open="open"
      :title="t(prefix + { SEND: 'send', APPROVE: 'approve', DISPUTE: 'dispute', WITHDRAW: 'withdraw' }[action])"
    >
      <template #body>
        <UForm novalidate :state="state" :schema="schema" class="space-y-4" @submit="submit">
          <p v-if="action === 'SEND' && selectedPeriod" class="text-sm">
            <strong>{{ selectedPeriod.clientName }}</strong
            ><br />
            {{ dateLabel(selectedPeriod.startsOn) }} – {{ dateLabel(selectedPeriod.endsOn) }} ·
            {{ t(prefix + 'hours', { hours: (selectedPeriod.totalMinutes / 60).toFixed(2) }) }}
          </p>
          <p v-if="action === 'WITHDRAW'">{{ t(prefix + 'confirmWithdraw') }}</p>
          <UFormField name="comment" :label="t(prefix + (action === 'SEND' ? 'message' : 'comment'))"
            ><UTextarea v-model="state.comment" class="w-full"
          /></UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="open = false">{{ t(prefix + 'cancel') }}</UButton
            ><UButton type="submit" :loading="busy">{{ t(prefix + 'confirm') }}</UButton>
          </div>
        </UForm>
      </template>
    </UModal>
    <UModal v-if="detailsOpen" v-model:open="detailsOpen" :title="t(prefix + 'entries')" :ui="{ content: 'max-w-5xl' }">
      <template #body>
        <div class="space-y-4 overflow-x-auto">
          <p>{{ selected?.startsOn }} – {{ selected?.endsOn }}</p>
          <table class="w-full text-left text-sm">
            <thead>
              <tr>
                <th>{{ t(prefix + 'person') }}</th>
                <th>{{ t(prefix + 'project') }}</th>
                <th>{{ t(prefix + 'period') }}</th>
                <th>{{ t('features.timesheets.approvals.sortHours') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in grouped" :key="`${group.person}/${group.project}/${group.week}`">
                <td class="py-2">{{ group.person }}</td>
                <td>{{ group.project }}</td>
                <td>{{ group.week }}</td>
                <td>{{ (group.minutes / 60).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
          <table class="w-full text-left text-sm">
            <thead>
              <tr>
                <th>{{ t(prefix + 'date') }}</th>
                <th>{{ t(prefix + 'person') }}</th>
                <th>{{ t(prefix + 'project') }}</th>
                <th>{{ t(prefix + 'activity') }}</th>
                <th>{{ t('features.timesheets.approvals.sortHours') }}</th>
                <th>{{ t(prefix + 'note') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in selected?.entries" :key="entry.id">
                <td class="py-2">{{ entry.date }}</td>
                <td>{{ entry.person }}</td>
                <td>{{ entry.project }}</td>
                <td>{{ entry.activity }}</td>
                <td>{{ (entry.minutes / 60).toFixed(2) }}</td>
                <td class="whitespace-pre-wrap">{{ entry.note }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="selected?.replacesIds.length">
            {{ t(prefix + 'replacement') }}:
            <NuxtLink
              v-for="id in selected.replacesIds"
              :key="id"
              :to="{ query: { ...route.query, request: id } }"
              class="mr-2 underline"
              >{{ t(prefix + 'revision', { number: requests?.find((r) => r.id === id)?.revision ?? id }) }}</NuxtLink
            >
          </p>
          <h3 v-if="selected?.history.length" class="font-semibold">{{ t(prefix + 'history') }}</h3>
          <div v-for="(event, index) in selected?.history" :key="index" class="border-t border-default pt-2">
            <p>
              {{ event.createdAt }} · {{ event.actor }} ·
              {{ event.action === 'SENT' ? t(prefix + 'send') : t(prefix + 'statuses.' + event.action) }}
            </p>
            <p class="whitespace-pre-wrap text-sm">{{ event.comment }}</p>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
