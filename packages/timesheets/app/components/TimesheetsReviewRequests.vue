<script setup lang="ts">
import { z } from 'zod'
import type { ClientReviewPeriodDto, ClientReviewRequestDto } from '../../shared/types/client-review-request'

const props = defineProps<{ clientSide?: boolean }>()
const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const prefix = 'features.timesheets.reviewPeriods.'
const endpoint = computed(() => `/api/timesheets/${props.clientSide ? 'client' : 'admin'}/review-requests`)
const {
  data: requests,
  error,
  refresh
} = await useFetch<ClientReviewRequestDto[], import('#app').NuxtError<unknown>, string>(endpoint)
const month = ref(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(0, 7))
const search = ref('')
const status = ref(typeof route.query.status === 'string' ? route.query.status : 'ALL')
const page = ref(1)
const periods = ref<ClientReviewPeriodDto[]>([])
const startsOn = ref('')
const busy = ref(false)
const affectedRequests = ref<Array<{ id: string; clientName: string; startsOn: string; endsOn: string }>>([])
const loadPeriods = async () => {
  if (!props.clientSide) {
    const result = await $fetch<{ periods: ClientReviewPeriodDto[]; startsOn: string }, string>(
      '/api/timesheets/admin/review-periods',
      { query: { month: month.value } }
    )
    periods.value = result.periods
    startsOn.value = result.startsOn
  }
}
await loadPeriods()
watch(month, loadPeriods)
watch([search, status], () => {
  page.value = 1
})
const filtered = computed(() =>
  (requests.value ?? []).filter(
    (r) =>
      (status.value === 'ALL' || r.status === status.value) &&
      `${r.clientName} ${r.supplierName} ${r.startsOn} ${r.endsOn}`.toLowerCase().includes(search.value.toLowerCase())
  )
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
      detail(request)
    }
  },
  { immediate: true }
)
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">{{ t(prefix + (clientSide ? 'clientTitle' : 'title')) }}</h2>
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
    <template v-if="!clientSide">
      <p v-if="startsOn" class="text-sm text-muted">{{ t(prefix + 'cutover', { date: startsOn }) }}</p>
      <UFormField :label="t(prefix + 'month')"><UInput v-model="month" type="month" /></UFormField>
      <div class="grid gap-3 lg:grid-cols-2">
        <UCard v-for="period in periods" :key="`${period.workspaceClientId}/${period.startsOn}`">
          <h3 class="font-semibold">{{ period.clientName }}</h3>
          <p>{{ period.startsOn }} – {{ period.endsOn }}</p>
          <p>{{ t(prefix + 'hours', { hours: (period.totalMinutes / 60).toFixed(2) }) }}</p>
          <p v-if="period.outstandingCount" class="text-sm text-warning">
            {{ t(prefix + 'outstanding', { count: period.outstandingCount }) }}
          </p>
          <p v-else-if="!period.hasReviewers" class="text-sm text-warning">{{ t(prefix + 'noReviewers') }}</p>
          <p v-else-if="!period.availableCount" class="text-sm text-muted">{{ t(prefix + 'noTime') }}</p>
          <p v-else-if="!period.canSend" class="text-sm text-muted">{{ t(prefix + 'notReady') }}</p>
          <ul v-if="period.outstandingEntries.length" class="mt-2 text-sm text-muted">
            <li v-for="entry in period.outstandingEntries" :key="entry.id">{{ entry.date }} · {{ entry.person }}</li>
          </ul>
          <UButton class="mt-3" :disabled="!period.canSend" @click="begin('SEND', null, period)">{{
            t(prefix + 'send')
          }}</UButton>
        </UCard>
      </div>
      <p class="text-sm text-muted">{{ t(prefix + 'withdrawHelp') }}</p>
    </template>
    <div class="flex flex-wrap gap-3">
      <UInput v-model="search" :placeholder="t(prefix + 'filter')" class="min-w-56 flex-1" />
      <USelect
        v-model="status"
        :items="[
          { value: 'ALL', label: t('features.timesheets.approvals.allStatuses') },
          ...['PENDING', 'APPROVED', 'DISPUTED', 'WITHDRAWN'].map((value) => ({
            value,
            label: t(prefix + 'statuses.' + value)
          }))
        ]"
        value-key="value"
      />
    </div>
    <p v-if="!filtered.length" class="text-muted">{{ t(prefix + 'empty') }}</p>
    <UCard v-for="request in visible" :id="`request-${request.id}`" :key="request.id">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="font-semibold">{{ clientSide ? request.supplierName : request.clientName }}</h3>
          <p>
            {{ request.startsOn }} – {{ request.endsOn }} · {{ t(prefix + 'revision', { number: request.revision }) }}
          </p>
          <p>
            {{
              t(prefix + 'hours', { hours: (request.entries.reduce((sum, e) => sum + e.minutes, 0) / 60).toFixed(2) })
            }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UBadge variant="subtle">{{ t(prefix + 'statuses.' + request.status) }}</UBadge>
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
          v-if="!clientSide && request.status !== 'WITHDRAWN'"
          color="warning"
          variant="outline"
          @click="begin('WITHDRAW', request)"
          >{{ t(prefix + 'withdraw') }}</UButton
        >
      </div>
    </UCard>
    <UPagination v-if="filtered.length > 10" v-model:page="page" :total="filtered.length" :items-per-page="10" />
    <UModal
      v-if="open"
      v-model:open="open"
      :title="t(prefix + { SEND: 'send', APPROVE: 'approve', DISPUTE: 'dispute', WITHDRAW: 'withdraw' }[action])"
    >
      <template #body>
        <UForm novalidate :state="state" :schema="schema" class="space-y-4" @submit="submit">
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
          <h3 class="font-semibold">{{ t(prefix + 'history') }}</h3>
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
