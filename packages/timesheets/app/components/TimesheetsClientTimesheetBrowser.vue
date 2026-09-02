<!-- Hallmark · shared client timesheet collection and detail browser -->
<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import type {
  ClientApprovalItemDto,
  ClientReviewStatus,
  ClientSupplierTimesheetItemDto
} from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{ mode: 'review' | 'view' }>()
type Item = ClientApprovalItemDto | ClientSupplierTimesheetItemDto
type ReadonlyItem = DeepReadonly<Item>
type ReadonlyApprovalItem = DeepReadonly<ClientApprovalItemDto>
type BadgeColor = 'success' | 'error' | 'warning' | 'neutral'
const { t, locale } = useI18n()
const api = useTimesheets()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const disputeOpen = ref(false)
const disputeComment = ref('')
const saving = ref(false)
const isReview = computed(() => props.mode === 'review')
const detailQueryKey = computed(() => (isReview.value ? 'review' : 'detail'))
const endpoint = computed(() =>
  isReview.value ? '/api/timesheets/client/approvals' : '/api/timesheets/client/supplier-timesheets'
)
const filterKeys = computed(() => (isReview.value ? ['workspaceClientId', 'status'] : ['workspaceClientId']))
const listing = useTimesheetsAdminList<Item>({
  endpoint: endpoint.value,
  filterKeys: filterKeys.value,
  defaultSort: 'weekStartsOn',
  defaultSortDir: 'desc'
})
const { data: supplierOptions } = await useAsyncData(`timesheet-client-${props.mode}-suppliers`, () =>
  isReview.value ? api.clientApprovalSuppliers() : api.clientSupplierOptions()
)
const selectedId = computed(() =>
  typeof route.query[detailQueryKey.value] === 'string' ? String(route.query[detailQueryKey.value]) : ''
)
const selected = computed(() => listing.items.value.find((item) => item.id === selectedId.value) ?? null)
const filters = computed(() => [
  ...(isReview.value
    ? [
        {
          key: 'status',
          placeholder: t('features.timesheets.approvals.statusFilter'),
          items: [
            { label: t('features.timesheets.approvals.allStatuses'), value: undefined },
            { label: t('features.timesheets.clientPortal.pending'), value: 'PENDING' },
            { label: t('features.timesheets.clientPortal.approved'), value: 'APPROVED' },
            { label: t('features.timesheets.clientPortal.disputed'), value: 'DISPUTED' }
          ]
        }
      ]
    : []),
  {
    key: 'workspaceClientId',
    placeholder: t('features.timesheets.approvals.supplierFilter'),
    items: [
      { label: t('features.timesheets.approvals.allSuppliers'), value: undefined },
      ...(supplierOptions.value ?? []).map((item) => ({ label: item.name, value: item.id }))
    ]
  }
])
const sortOptions = computed(() => [
  { label: t('features.timesheets.approvals.sortNewest'), value: 'weekStartsOn' },
  { label: t('features.timesheets.approvals.sortSupplier'), value: 'supplierName' },
  { label: t('features.timesheets.approvals.sortPerson'), value: 'person' },
  { label: t('features.timesheets.approvals.sortHours'), value: 'totalMinutes' },
  ...(isReview.value ? [{ label: t('features.timesheets.approvals.sortStatus'), value: 'status' }] : [])
])
const hours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const batchPeriod = (from: string, to: string) =>
  new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(
    new Date(`${from}T12:00:00`),
    new Date(`${to}T12:00:00`)
  )
const reviewStatusColor = (value: ClientReviewStatus): BadgeColor =>
  value === 'APPROVED' ? 'success' : value === 'DISPUTED' ? 'error' : 'warning'
const isApprovalItem = (item: ReadonlyItem): item is ReadonlyApprovalItem => 'canAct' in item
const itemStatus = (item: ReadonlyItem): { label: string; color: BadgeColor } => ({
  label: t(`features.timesheets.clientPortal.${item.status.toLowerCase()}`),
  color: reviewStatusColor(item.status)
})
const historyKey = (action: string) =>
  ({
    SUBMITTED: 'submitted',
    APPROVED_INTERNAL: 'approvedInternal',
    REOPENED: 'reopened',
    APPROVED_CLIENT: 'approvedClient',
    DISPUTED_CLIENT: 'disputedClient'
  })[action] ?? 'submitted'
const openDetail = (item: ReadonlyItem) => router.push({ query: { ...route.query, [detailQueryKey.value]: item.id } })
const closeDetail = () => router.push({ query: { ...route.query, [detailQueryKey.value]: undefined } })
const act = async (item: ReadonlyApprovalItem, action: 'APPROVE' | 'DISPUTE') => {
  saving.value = true
  try {
    await api.reviewClientSlice(item.workspaceClientId, item.submissionId, {
      action,
      expectedVersion: item.version,
      comment: action === 'DISPUTE' ? disputeComment.value : null
    })
    disputeOpen.value = false
    disputeComment.value = ''
    await listing.refresh()
    window.dispatchEvent(new CustomEvent('timesheets:capabilities-refresh'))
    toast.add({
      title: t(
        action === 'APPROVE'
          ? 'features.timesheets.approvals.approvedMessage'
          : 'features.timesheets.approvals.disputedMessage'
      ),
      color: 'success'
    })
  } catch {
    await listing.refresh()
    toast.add({
      title: t('features.timesheets.approvals.conflictTitle'),
      description: t('features.timesheets.approvals.conflictDescription'),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}
await listing.load()
</script>

<template>
  <TimesheetsPageShell class="flex h-full min-h-0 flex-col overflow-hidden">
    <header class="shrink-0 border-b border-default pb-5">
      <div class="flex items-center gap-2">
        <UIcon :name="isReview ? 'i-lucide-stamp' : 'i-lucide-building-2'" class="size-6 shrink-0" />
        <h1 class="text-2xl font-semibold text-highlighted">
          {{ t(isReview ? 'features.timesheets.approvals.title' : 'features.timesheets.suppliers.title') }}
        </h1>
      </div>
      <p class="mt-1 hidden text-sm text-muted sm:block">
        {{ t(isReview ? 'features.timesheets.approvals.subtitle' : 'features.timesheets.suppliers.subtitle') }}
      </p>
    </header>
    <div v-if="selected" class="min-h-0 flex-1 overflow-y-auto">
      <div class="py-5">
        <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="closeDetail">
          {{ t(isReview ? 'features.timesheets.approvals.back' : 'features.timesheets.suppliers.back') }}
        </UButton>
      </div>
      <article class="overflow-hidden rounded-lg border border-default bg-default">
        <header class="flex flex-wrap items-start justify-between gap-4 border-b border-default p-5">
          <div>
            <p class="text-sm font-medium text-primary">{{ selected.supplierName }}</p>
            <h2 class="mt-1 text-xl font-semibold">
              {{ batchPeriod(selected.periodStartsOn, selected.periodEndsOn) }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ selected.person }} ·
              {{ t('features.timesheets.approvals.totalHours', { hours: hours(selected.totalMinutes) }) }}
            </p>
          </div>
          <UBadge :color="itemStatus(selected).color" variant="subtle">{{ itemStatus(selected).label }}</UBadge>
        </header>
        <UAlert
          v-if="
            isReview &&
            isApprovalItem(selected) &&
            selected.status === 'PENDING' &&
            selected.canManageReviewers &&
            !selected.hasReviewers
          "
          color="warning"
          icon="i-lucide-triangle-alert"
          :title="t('features.timesheets.approvals.noReviewers')"
          :description="t('features.timesheets.approvals.noReviewersDescription')"
          class="m-5"
          variant="outline"
        >
          <template #actions>
            <UButton
              :to="`/timesheets/approvals/reviewers?supplier=${selected.workspaceClientId}`"
              size="sm"
              color="warning"
            >
              {{ t('features.timesheets.approvals.assignReviewers') }}
            </UButton>
          </template>
        </UAlert>
        <div class="divide-y divide-default px-5">
          <div
            v-for="entry in selected.entries"
            :key="entry.id"
            class="grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_5rem]"
          >
            <span class="text-sm text-muted">{{ formatDate(entry.date) }}</span>
            <div>
              <p class="text-sm font-medium">{{ entry.project }} · {{ entry.activity }}</p>
              <p v-if="entry.note" class="mt-1 text-sm text-muted">{{ entry.note }}</p>
            </div>
            <strong class="text-sm sm:text-right">{{ hours(entry.minutes) }}</strong>
          </div>
        </div>
        <section v-if="selected.history.length" class="border-t border-default p-5">
          <h3 class="text-sm font-semibold">{{ t('features.timesheets.clientPortal.history') }}</h3>
          <ol class="mt-4 space-y-4">
            <li
              v-for="item in [...selected.history].reverse()"
              :key="item.id"
              class="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 text-sm"
            >
              <UIcon name="i-lucide-history" class="mt-0.5 size-4 text-muted" />
              <div>
                <p>
                  {{
                    t(`features.timesheets.clientPortal.historyActions.${historyKey(item.action)}`, {
                      actor: item.actorName
                    })
                  }}
                </p>
                <p class="text-xs text-muted">{{ formatDateTime(item.createdAt) }}</p>
                <p v-if="item.comment" class="mt-1 text-muted">{{ item.comment }}</p>
              </div>
            </li>
          </ol>
        </section>
        <footer
          v-if="isReview && isApprovalItem(selected) && selected.canAct"
          class="flex justify-end gap-2 border-t border-default bg-elevated/40 p-5"
        >
          <UButton color="neutral" variant="outline" :disabled="saving" @click="disputeOpen = true">
            {{ t('features.timesheets.clientPortal.dispute') }} </UButton
          ><UButton icon="i-lucide-check" :loading="saving" @click="act(selected, 'APPROVE')">
            {{ t('features.timesheets.clientPortal.approve') }}
          </UButton>
        </footer>
      </article>
      <UModal
        v-if="isReview && selected && isApprovalItem(selected)"
        v-model:open="disputeOpen"
        :title="t('features.timesheets.approvals.disputeTitle')"
        :description="t('features.timesheets.approvals.disputeDescription')"
      >
        <template #body>
          <UTextarea
            v-model="disputeComment"
            autofocus
            :placeholder="t('features.timesheets.clientPortal.comment')"
            class="w-full"
          /> </template
        ><template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="disputeOpen = false">
              {{ t('features.timesheets.cancel') }} </UButton
            ><UButton
              color="error"
              :loading="saving"
              :disabled="!disputeComment.trim()"
              @click="act(selected, 'DISPUTE')"
            >
              {{ t('features.timesheets.clientPortal.dispute') }}
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
    <section v-else class="flex min-h-0 flex-1 flex-col gap-5 pt-5">
      <TimesheetsAdminListToolbar
        v-model:search="listing.search.value"
        :filters="filters"
        :filter-values="listing.filters"
        :sort-options="sortOptions"
        :sort-by="listing.sortBy.value"
        :sort-dir="listing.sortDir.value"
        @filter="listing.setFilter"
        @sort="listing.sortBy.value = $event"
        @toggle-direction="listing.toggleSortDir"
      />
      <TimesheetsAdminPaginatedList
        class="min-h-0 flex-1"
        :pagination="listing.pagination.value"
        :pending="listing.pending.value"
        :loading-next="listing.loadingNextPage.value"
        :loading-previous="listing.loadingPreviousPage.value"
        :has-next="listing.hasNextPage.value"
        :has-previous="listing.hasPreviousPage.value"
        @next="listing.loadNext"
        @previous="listing.loadPrevious"
        @page="listing.goToPage"
      >
        <UAlert
          v-if="!listing.items.value.length && !listing.pending.value"
          icon="i-lucide-search-x"
          :title="
            t(isReview ? 'features.timesheets.approvals.emptyFiltered' : 'features.timesheets.suppliers.emptyFiltered')
          "
          :description="
            t(
              isReview
                ? 'features.timesheets.approvals.emptyFilteredDescription'
                : 'features.timesheets.suppliers.emptyFilteredDescription'
            )
          "
          variant="outline"
        />
        <div v-else class="grid gap-3">
          <UCard
            v-for="item in listing.items.value"
            :key="item.id"
            class="cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            role="button"
            tabindex="0"
            @click="openDetail(item)"
            @keydown.enter="openDetail(item)"
            @keydown.space.prevent="openDetail(item)"
          >
            <div class="grid gap-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_8rem_auto] sm:items-center">
              <div class="min-w-0">
                <p class="flex items-center gap-2 font-medium">
                  <UIcon name="i-lucide-building-2" class="size-4 shrink-0 text-muted" /><span class="truncate">{{
                    item.supplierName
                  }}</span>
                </p>
                <p class="mt-1 flex items-center gap-2 text-sm text-muted">
                  <UIcon name="i-lucide-user-round" class="size-4 shrink-0" /><span class="truncate">{{
                    item.person
                  }}</span>
                </p>
              </div>
              <div>
                <p class="flex items-center gap-2 text-sm font-medium">
                  <UIcon name="i-lucide-calendar-days" class="size-4 shrink-0 text-muted" />{{
                    batchPeriod(item.periodStartsOn, item.periodEndsOn)
                  }}
                </p>
                <p class="mt-1 flex items-center gap-2 text-xs text-muted">
                  <UIcon name="i-lucide-clock-3" class="size-4 shrink-0" />{{
                    t('features.timesheets.approvals.totalHours', { hours: hours(item.totalMinutes) })
                  }}
                </p>
              </div>
              <div>
                <UBadge :color="itemStatus(item).color" variant="subtle">{{ itemStatus(item).label }}</UBadge>
                <p v-if="isApprovalItem(item)" class="mt-2 flex items-center gap-1 text-xs text-muted">
                  <UIcon name="i-lucide-user-check" class="size-3.5 shrink-0" />{{ item.reviewerName ?? '—' }}
                </p>
              </div>
              <UButton
                color="neutral"
                variant="ghost"
                trailing-icon="i-lucide-chevron-right"
                tabindex="-1"
                @click.stop="openDetail(item)"
              >
                {{
                  isReview && isApprovalItem(item) && item.canAct
                    ? t('features.timesheets.approvals.reviewTimesheet')
                    : t('features.timesheets.approvals.viewDetails')
                }}
              </UButton>
            </div>
          </UCard>
        </div>
      </TimesheetsAdminPaginatedList>
    </section>
  </TimesheetsPageShell>
</template>
