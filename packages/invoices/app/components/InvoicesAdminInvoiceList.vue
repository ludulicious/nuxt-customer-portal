<script setup lang="ts">
import type { InvoiceListContext } from '@nuxt-customer-portal/invoices/app/composables/useInvoices'
import type { InvoiceSummaryDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import { currencyScale } from '@nuxt-customer-portal/invoices/shared/money'

const props = defineProps<{ context?: InvoiceListContext; contextPending: boolean; contextError?: unknown }>()
const { t, locale } = useI18n()
const route = useRoute()
const listing = useInvoicesAdminList<InvoiceSummaryDto>({
  endpoint: '/api/invoices/admin/invoices',
  filterKeys: ['status', 'clientOrganizationId', 'overdue'],
  defaultSort: 'issueDate',
  defaultSortDir: 'desc',
  preservePosition: true
})
const filters = computed(() => [
  {
    key: 'status',
    placeholder: t('features.invoices.admin.list.statusFilter'),
    items: [
      { label: t('features.invoices.admin.list.allStatuses'), value: undefined },
      ...(['DRAFT', 'ISSUED', 'PAID', 'VOID'] as const).map((status) => ({
        label: t(`features.invoices.admin.invoiceStatus.${status.toLowerCase()}`),
        value: status
      }))
    ]
  },
  {
    key: 'clientOrganizationId',
    placeholder: t('features.invoices.admin.list.clientFilter'),
    items: [
      { label: t('features.invoices.admin.list.allClients'), value: undefined },
      ...(props.context?.clients ?? []).map((client) => ({ label: client.name, value: client.organizationId }))
    ]
  },
  {
    key: 'overdue',
    placeholder: t('features.invoices.admin.list.overdueFilter'),
    items: [
      { label: t('features.invoices.admin.list.allPaymentStates'), value: undefined },
      { label: t('features.invoices.admin.list.overdue'), value: 'true' },
      { label: t('features.invoices.admin.list.notOverdue'), value: 'false' }
    ]
  }
])
const sortOptions = computed(() => [
  { label: t('features.invoices.admin.list.sortIssueDate'), value: 'issueDate' },
  { label: t('features.invoices.admin.list.sortDueDate'), value: 'dueDate' },
  { label: t('features.invoices.admin.list.sortNumber'), value: 'number' },
  { label: t('features.invoices.admin.list.sortTotal'), value: 'totalMinor' }
])
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(minor / currencyScale(currency))
const dateTime = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusColor = (status: string) =>
  status === 'PAID' ? 'success' : status === 'ISSUED' ? 'info' : status === 'VOID' ? 'error' : 'neutral'
const canCreate = computed(() => Boolean(props.context?.canCreate))
const openCreate = () =>
  navigateTo(canCreate.value ? '/admin/invoices/new' : '/admin/invoices/settings#sender-invoice-details')
defineExpose({
  canCreate,
  openCreate,
  refreshList: () => listing.refresh(),
  showCreate: computed(() => Boolean(listing.pagination.value.total) && canCreate.value)
})
// Mount the list shell immediately. Supporting filter options never gate the
// collection request, including restoration of accumulated pages and scroll.
onMounted(() => {
  void listing.restore()
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-4">
    <InvoicesAdminListToolbar
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
    <UAlert
      v-if="contextError || listing.error.value"
      color="error"
      variant="outline"
      icon="i-lucide-circle-alert"
      :title="t('features.invoices.messages.fetchError')"
    />
    <div
      v-if="listing.pending.value && !listing.items.value.length"
      role="status"
      :aria-label="t('common.loading')"
      class="flex justify-center py-12 text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
    </div>
    <InvoicesAdminEmptyState
      v-else-if="context && !canCreate"
      icon="i-lucide-file-warning"
      :title="t('features.invoices.admin.senderDetailsRequiredTitle')"
      :description="t('features.invoices.admin.senderDetailsRequiredDescription')"
      :action-label="t('features.invoices.admin.completeSenderDetails')"
      action-icon="i-lucide-settings-2"
      @action="openCreate"
    />
    <InvoicesAdminEmptyState
      v-else-if="context && !contextPending && !listing.error.value && !listing.items.value.length"
      icon="i-lucide-file-text"
      :title="t('features.invoices.admin.noInvoicesTitle')"
      :description="t('features.invoices.admin.noInvoicesDescription')"
      :action-label="t('features.invoices.admin.createFirstInvoice')"
      @action="openCreate"
    />
    <InvoicesAdminPaginatedList
      v-if="listing.items.value.length"
      :key="listing.scrollKey.value"
      class="min-h-0 flex-1"
      :pagination="listing.pagination.value"
      :pending="listing.pending.value"
      :loading-next="listing.loadingNextPage.value"
      :loading-previous="listing.loadingPreviousPage.value"
      :has-next="listing.hasNextPage.value"
      :has-previous="listing.hasPreviousPage.value"
      :initial-scroll-top="listing.initialScrollTop.value"
      @scroll="listing.updateScroll"
      @next="listing.loadNext"
      @previous="listing.loadPrevious"
      @page="listing.goToPage"
    >
      <div class="grid gap-3">
        <UCard
          v-for="invoice in listing.items.value"
          :key="invoice.id"
          :class="invoice.isOverdue ? 'ring-1 ring-warning/60' : ''"
          class="transition-colors hover:ring-1 hover:ring-primary/50"
        >
          <div class="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-3">
            <NuxtLink
              :to="{ path: `/admin/invoices/${invoice.id}`, query: { invoicesReturnTo: route.fullPath } }"
              class="group min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="min-w-0 break-words font-semibold">{{ invoice.number }} · {{ invoice.recipientName }}</p>
                <UBadge :color="statusColor(invoice.status)" variant="subtle">{{
                  t(`features.invoices.admin.invoiceStatus.${invoice.status.toLowerCase()}`)
                }}</UBadge>
                <UBadge v-if="invoice.isOverdue" color="warning" variant="subtle">{{
                  t('features.invoices.admin.overdueDays', { count: invoice.daysOverdue })
                }}</UBadge>
              </div>
              <p class="mt-1 whitespace-normal break-words text-sm text-muted">
                {{ t('features.invoices.admin.dueDate') }} {{ invoice.dueDate }} ·
                {{ money(invoice.totalMinor, invoice.currency) }} · {{ t('features.invoices.admin.outstanding') }}
                {{ money(invoice.outstandingMinor, invoice.currency) }}
              </p>
              <p v-if="invoice.isOverdue" class="mt-1 text-xs text-warning">
                {{
                  t('features.invoices.admin.reminderSummary', {
                    count: invoice.reminderCount,
                    date: invoice.lastReminderSentAt
                      ? dateTime(invoice.lastReminderSentAt)
                      : t('features.invoices.admin.never')
                  })
                }}
              </p>
            </NuxtLink>
            <NuxtLink
              :to="{ path: `/admin/invoices/${invoice.id}`, query: { invoicesReturnTo: route.fullPath } }"
              :aria-label="t('features.invoices.admin.openInvoice', { number: invoice.number })"
              class="grid size-11 shrink-0 place-items-center justify-self-end rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              ><UIcon name="i-lucide-chevron-right" class="size-5 text-muted"
            /></NuxtLink>
          </div>
        </UCard>
      </div>
    </InvoicesAdminPaginatedList>
  </section>
</template>
