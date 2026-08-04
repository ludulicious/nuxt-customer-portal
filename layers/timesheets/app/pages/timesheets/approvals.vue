<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import type { ClientApprovalItemDto, ClientReviewStatus } from '#layers/timesheets/shared/types/timesheet'

const { t, locale } = useI18n()
const api = useTimesheets()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const disputeOpen = ref(false)
const disputeComment = ref('')
const saving = ref(false)
const listing = useTimesheetsAdminList<ClientApprovalItemDto>({ endpoint: '/api/timesheets/client/approvals', filterKeys: ['workspaceClientId', 'status'], defaultSort: 'weekStartsOn', defaultSortDir: 'desc' })
const { data: supplierOptions } = await useAsyncData('timesheet-client-approval-suppliers', api.clientApprovalSuppliers)
const selectedId = computed(() => typeof route.query.review === 'string' ? route.query.review : '')
const selected = computed(() => listing.items.value.find(item => item.id === selectedId.value) ?? null)
const filters = computed(() => [{ key: 'status', placeholder: t('features.timesheets.approvals.statusFilter'), items: [{ label: t('features.timesheets.approvals.allStatuses'), value: undefined }, { label: t('features.timesheets.clientPortal.pending'), value: 'PENDING' }, { label: t('features.timesheets.clientPortal.approved'), value: 'APPROVED' }, { label: t('features.timesheets.clientPortal.disputed'), value: 'DISPUTED' }] }, { key: 'workspaceClientId', placeholder: t('features.timesheets.approvals.supplierFilter'), items: [{ label: t('features.timesheets.approvals.allSuppliers'), value: undefined }, ...(supplierOptions.value ?? []).map(item => ({ label: item.name, value: item.id }))] }])
const sortOptions = computed(() => [{ label: t('features.timesheets.approvals.sortNewest'), value: 'weekStartsOn' }, { label: t('features.timesheets.approvals.sortSupplier'), value: 'supplierName' }, { label: t('features.timesheets.approvals.sortPerson'), value: 'person' }, { label: t('features.timesheets.approvals.sortStatus'), value: 'status' }, { label: t('features.timesheets.approvals.sortHours'), value: 'totalMinutes' }])
const hours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
const formatDate = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
const weekNumber = (weekStartsOn: string) => {
  const date = new Date(`${weekStartsOn}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4, 12))
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7))
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000)
}
const weekPeriod = (weekStartsOn: string) => {
  const start = new Date(`${weekStartsOn}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const formatter = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
  return t('features.timesheets.clientPortal.weekPeriod', { week: weekNumber(weekStartsOn), period: formatter.formatRange(start, end) })
}
const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusColor = (value: ClientReviewStatus) => value === 'APPROVED' ? 'success' : value === 'DISPUTED' ? 'error' : 'warning'
const historyKey = (action: string) => ({ SUBMITTED: 'submitted', APPROVED_INTERNAL: 'approvedInternal', REOPENED: 'reopened', APPROVED_CLIENT: 'approvedClient', DISPUTED_CLIENT: 'disputedClient' })[action] ?? 'submitted'
const openReview = (item: DeepReadonly<ClientApprovalItemDto>) => router.push({ query: { ...route.query, review: item.id } })
const closeReview = () => router.push({ query: { ...route.query, review: undefined } })
const act = async (item: DeepReadonly<ClientApprovalItemDto>, action: 'APPROVE' | 'DISPUTE') => {
  saving.value = true
  try {
    await api.reviewClientSlice(item.workspaceClientId, item.weeklyTimesheetId, { action, expectedVersion: item.version, comment: action === 'DISPUTE' ? disputeComment.value : null })
    disputeOpen.value = false
    disputeComment.value = ''
    await listing.refresh()
    window.dispatchEvent(new CustomEvent('timesheets:capabilities-refresh'))
    toast.add({ title: t(action === 'APPROVE' ? 'features.timesheets.approvals.approvedMessage' : 'features.timesheets.approvals.disputedMessage'), color: 'success' })
  } catch {
    await listing.refresh()
    toast.add({ title: t('features.timesheets.approvals.conflictTitle'), description: t('features.timesheets.approvals.conflictDescription'), color: 'error' })
  } finally { saving.value = false }
}
useSeoMeta({ title: () => t('features.timesheets.approvals.title') })
await listing.load()
</script>

<template>
  <NuxtPage v-if="route.path !== '/timesheets/approvals'" />
  <div v-else class="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
    <header class="shrink-0 border-b border-default pb-5">
      <div class="flex items-center gap-2"><UIcon name="i-lucide-stamp" class="size-6 shrink-0" /><h1 class="text-2xl font-semibold text-highlighted">{{ t('features.timesheets.approvals.title') }}</h1></div><p class="mt-1 text-sm text-muted">{{ t('features.timesheets.approvals.subtitle') }}</p>
    </header>

    <div v-if="selected" class="min-h-0 flex-1 overflow-y-auto">
      <div class="py-5"><UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="closeReview">{{ t('features.timesheets.approvals.back') }}</UButton></div>
      <article class="overflow-hidden rounded-lg border border-default bg-default">
        <header class="flex flex-wrap items-start justify-between gap-4 border-b border-default p-5">
          <div><p class="text-sm font-medium text-primary">{{ selected.supplierName }}</p><h2 class="mt-1 text-xl font-semibold">{{ weekPeriod(selected.weekStartsOn) }}</h2><p class="mt-1 text-sm text-muted">{{ selected.person }} · {{ t('features.timesheets.approvals.totalHours', { hours: hours(selected.totalMinutes) }) }}</p></div>
          <UBadge :color="statusColor(selected.status)" variant="subtle">{{ t(`features.timesheets.clientPortal.${selected.status.toLowerCase()}`) }}</UBadge>
        </header>
        <UAlert v-if="selected.status === 'PENDING' && selected.canManageReviewers && !selected.hasReviewers" color="warning" icon="i-lucide-triangle-alert" :title="t('features.timesheets.approvals.noReviewers')" :description="t('features.timesheets.approvals.noReviewersDescription')" class="m-5" variant="outline">
          <template #actions><UButton :to="`/timesheets/approvals/reviewers?supplier=${selected.workspaceClientId}`" size="sm" color="warning">{{ t('features.timesheets.approvals.assignReviewers') }}</UButton></template>
        </UAlert>
        <div class="divide-y divide-default px-5">
          <div v-for="entry in selected.entries" :key="entry.id" class="grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_5rem]">
            <span class="text-sm text-muted">{{ formatDate(entry.date) }}</span><div><p class="text-sm font-medium">{{ entry.project }} · {{ entry.activity }}</p><p v-if="entry.note" class="mt-1 text-sm text-muted">{{ entry.note }}</p></div><strong class="text-sm sm:text-right">{{ hours(entry.minutes) }}</strong>
          </div>
        </div>
        <section v-if="selected.history.length" class="border-t border-default p-5"><h3 class="text-sm font-semibold">{{ t('features.timesheets.clientPortal.history') }}</h3><ol class="mt-4 space-y-4"><li v-for="item in [...selected.history].reverse()" :key="item.id" class="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 text-sm"><UIcon name="i-lucide-history" class="mt-0.5 size-4 text-muted" /><div><p>{{ t(`features.timesheets.clientPortal.historyActions.${historyKey(item.action)}`, { actor: item.actorName }) }}</p><p class="text-xs text-muted">{{ formatDateTime(item.createdAt) }}</p><p v-if="item.comment" class="mt-1 text-muted">{{ item.comment }}</p></div></li></ol></section>
        <footer v-if="selected.canAct" class="flex justify-end gap-2 border-t border-default bg-elevated/40 p-5"><UButton color="neutral" variant="outline" :disabled="saving" @click="disputeOpen = true">{{ t('features.timesheets.clientPortal.dispute') }}</UButton><UButton icon="i-lucide-check" :loading="saving" @click="act(selected, 'APPROVE')">{{ t('features.timesheets.clientPortal.approve') }}</UButton></footer>
      </article>
      <UModal v-model:open="disputeOpen" :title="t('features.timesheets.approvals.disputeTitle')" :description="t('features.timesheets.approvals.disputeDescription')">
        <template #body><UTextarea v-model="disputeComment" autofocus :placeholder="t('features.timesheets.clientPortal.comment')" class="w-full" /></template>
        <template #footer><div class="flex w-full justify-end gap-2"><UButton color="neutral" variant="ghost" @click="disputeOpen = false">{{ t('features.timesheets.cancel') }}</UButton><UButton color="error" :loading="saving" :disabled="!disputeComment.trim()" @click="act(selected!, 'DISPUTE')">{{ t('features.timesheets.clientPortal.dispute') }}</UButton></div></template>
      </UModal>
    </div>

    <section v-else class="flex min-h-0 flex-1 flex-col gap-5 pt-5">
      <TimesheetsAdminListToolbar v-model:search="listing.search.value" :filters="filters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
      <TimesheetsAdminPaginatedList class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
        <UAlert v-if="!listing.items.value.length && !listing.pending.value" icon="i-lucide-search-x" :title="t('features.timesheets.approvals.emptyFiltered')" :description="t('features.timesheets.approvals.emptyFilteredDescription')" variant="outline" />
        <div v-else class="grid gap-3">
          <UCard v-for="item in listing.items.value" :key="item.id" class="cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" role="button" tabindex="0" @click="openReview(item)" @keydown.enter="openReview(item)" @keydown.space.prevent="openReview(item)">
            <div class="grid gap-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_8rem_auto] sm:items-center">
              <div class="min-w-0"><p class="flex items-center gap-2 font-medium"><UIcon name="i-lucide-building-2" class="size-4 shrink-0 text-muted" /><span class="truncate">{{ item.supplierName }}</span></p><p class="mt-1 flex items-center gap-2 text-sm text-muted"><UIcon name="i-lucide-user-round" class="size-4 shrink-0" /><span class="truncate">{{ item.person }}</span></p></div>
              <div><p class="flex items-center gap-2 text-sm font-medium"><UIcon name="i-lucide-calendar-days" class="size-4 shrink-0 text-muted" />{{ weekPeriod(item.weekStartsOn) }}</p><p class="mt-1 flex items-center gap-2 text-xs text-muted"><UIcon name="i-lucide-clock-3" class="size-4 shrink-0" />{{ t('features.timesheets.approvals.totalHours', { hours: hours(item.totalMinutes) }) }}</p></div>
              <div><UBadge :color="statusColor(item.status)" variant="subtle">{{ t(`features.timesheets.clientPortal.${item.status.toLowerCase()}`) }}</UBadge><p class="mt-2 flex items-center gap-1 text-xs text-muted"><UIcon name="i-lucide-user-check" class="size-3.5 shrink-0" />{{ item.reviewerName ?? '—' }}</p></div>
              <UButton color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-right" tabindex="-1" @click.stop="openReview(item)">{{ item.canAct ? t('features.timesheets.approvals.reviewTimesheet') : t('features.timesheets.approvals.viewDetails') }}</UButton>
            </div>
          </UCard>
        </div>
      </TimesheetsAdminPaginatedList>
    </section>
  </div>
</template>
