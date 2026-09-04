<script setup lang="ts">
import type { ApprovalQueueItemDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const { t } = useI18n()
const timesheets = useTimesheets()
const { data, error } = await useAsyncData('timesheets-internal-approval-context', () =>
  timesheets.internalApprovalQueue(true)
)
const listing = useTimesheetsAdminList<ApprovalQueueItemDto>({
  endpoint: '/api/timesheets/internal-approvals/list',
  filterKeys: ['status', 'userId'],
  defaultSort: 'weekStartsOn',
  defaultSortDir: 'desc'
})
const filters = computed(() => [
  {
    key: 'userId',
    placeholder: t('features.timesheets.internalApprovals.memberFilter'),
    items: [
      { label: t('features.timesheets.internalApprovals.allMembers'), value: undefined },
      ...(data.value?.teamMembers ?? []).map((member) => ({ label: member.name, value: member.id }))
    ]
  },
  {
    key: 'status',
    placeholder: t('features.timesheets.approvals.statusFilter'),
    items: [
      { label: t('features.timesheets.approvals.allStatuses'), value: undefined },
      ...['SUBMITTED', 'APPROVED', 'REJECTED'].map((status) => ({
        label: t(`features.timesheets.status.${status.toLowerCase()}`),
        value: status
      }))
    ]
  }
])
const sortOptions = computed(() => [
  { label: t('features.timesheets.approvals.sortNewest'), value: 'weekStartsOn' },
  { label: t('features.timesheets.approvals.sortPerson'), value: 'userName' },
  { label: t('features.timesheets.approvals.sortHours'), value: 'totalMinutes' },
  { label: t('features.timesheets.approvals.sortStatus'), value: 'status' }
])
const approvalData = computed(() => (data.value ? { ...data.value, approvals: [...listing.items.value] } : null))
await listing.load()
useSeoMeta({ title: () => t('features.timesheets.internalApprovals.title') })
</script>

<template>
  <TimesheetsPageShell class="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
      <div class="flex min-w-0 gap-3">
        <UIcon name="i-lucide-stamp" class="mt-1 size-6 shrink-0 text-primary" />
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold text-highlighted">
            {{ t('features.timesheets.internalApprovals.title') }}
          </h1>
          <p class="hidden text-sm text-muted sm:block">
            {{ t('features.timesheets.internalApprovals.subtitle') }}
          </p>
        </div>
      </div>
    </header>
    <TimesheetsAdminListToolbar
      v-model:search="listing.search.value"
      class="shrink-0"
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
      <UAlert v-if="error || listing.error.value" color="error" :title="t('features.timesheets.dashboard.error')" />
      <div v-else-if="listing.pending.value && !listing.items.value.length" class="space-y-3">
        <USkeleton v-for="index in 3" :key="index" class="h-32 w-full" />
      </div>
      <UAlert
        v-else-if="!listing.items.value.length"
        icon="i-lucide-search-x"
        :title="t('features.timesheets.approvals.emptyFiltered')"
        :description="t('features.timesheets.approvals.emptyFilteredDescription')"
        variant="outline"
      />
      <TimesheetsAdminApprovals v-else-if="approvalData" :data="approvalData" :refresh="listing.refresh" />
    </TimesheetsAdminPaginatedList>
  </TimesheetsPageShell>
</template>
