<script setup lang="ts">
import type { ClientInvoiceSummaryDto, InvoiceStatus } from '@nuxt-customer-portal/invoices/shared/types/invoice'

const { t, locale } = useI18n()
const route = useRoute()
const listing = useInvoicesAdminList<ClientInvoiceSummaryDto>({ endpoint: '/api/invoices/client/invoices', filterKeys: ['accessId', 'status', 'overdue'], defaultSort: 'issueDate', defaultSortDir: 'desc' })
const { data: suppliers } = await useAsyncData('invoice-client-suppliers', useInvoices().clientInvoiceSuppliers)
const filters = computed(() => [
  { key: 'status', placeholder: t('features.invoices.clientInvoices.statusFilter'), items: [{ label: t('features.invoices.clientInvoices.allStatuses'), value: undefined }, { label: t('features.invoices.admin.invoiceStatus.issued'), value: 'ISSUED' }, { label: t('features.invoices.admin.invoiceStatus.paid'), value: 'PAID' }] },
  { key: 'accessId', placeholder: t('features.invoices.clientInvoices.supplierFilter'), items: [{ label: t('features.invoices.clientInvoices.allSuppliers'), value: undefined }, ...(suppliers.value ?? []).map(item => ({ label: item.providerName, value: item.id }))] },
  { key: 'overdue', placeholder: t('features.invoices.clientInvoices.paymentFilter'), items: [{ label: t('features.invoices.clientInvoices.allPayments'), value: undefined }, { label: t('features.invoices.clientInvoices.overdueOnly'), value: 'true' }, { label: t('features.invoices.clientInvoices.notOverdue'), value: 'false' }] }
])
const sortOptions = computed(() => [
  { label: t('features.invoices.admin.list.sortIssueDate'), value: 'issueDate' }, { label: t('features.invoices.admin.list.sortDueDate'), value: 'dueDate' },
  { label: t('features.invoices.admin.list.sortNumber'), value: 'number' }, { label: t('features.invoices.admin.list.sortTotal'), value: 'totalMinor' }
])
const money = (minor: number, currency: string) => new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(minor / 100)
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
const statusColor = (status: InvoiceStatus) => status === 'PAID' ? 'success' : 'info'
useSeoMeta({ title: () => t('features.invoices.clientInvoices.title') })
await listing.load()
</script>

<template>
  <NuxtPage v-if="route.path !== '/invoices'" />
  <InvoicesPageShell v-else class="flex h-full min-h-0 flex-col overflow-hidden">
    <header class="shrink-0 border-b border-default pb-5"><div class="flex items-center gap-2"><UIcon name="i-lucide-receipt-text" class="size-6" /><h1 class="text-2xl font-semibold">{{ t('features.invoices.clientInvoices.title') }}</h1></div><p class="mt-1 hidden text-sm text-muted sm:block">{{ t('features.invoices.clientInvoices.subtitle') }}</p></header>
    <section class="flex min-h-0 flex-1 flex-col gap-5 pt-5">
      <InvoicesAdminListToolbar v-model:search="listing.search.value" :filters="filters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
      <InvoicesAdminPaginatedList class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
        <UAlert v-if="!listing.items.value.length && !listing.pending.value" icon="i-lucide-receipt-text" :title="t('features.invoices.clientInvoices.empty')" :description="t('features.invoices.clientInvoices.emptyDescription')" variant="outline" />
        <div v-else class="grid gap-3">
          <UCard v-for="item in listing.items.value" :key="item.id" class="transition-colors hover:ring-primary/50">
            <NuxtLink :to="`/invoices/${item.id}`" class="grid gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_9rem_auto] sm:items-center">
              <div class="min-w-0"><p class="truncate font-semibold">{{ item.number }}</p><p class="mt-1 truncate text-sm text-muted">{{ item.supplierName }}</p></div>
              <div><p class="text-sm">{{ date(item.issueDate) }}</p><p class="mt-1 text-xs text-muted">{{ t('features.invoices.admin.dueDate') }} {{ date(item.dueDate) }}</p></div>
              <div><p class="font-medium">{{ money(item.totalMinor, item.currency) }}</p><p v-if="item.outstandingMinor" class="mt-1 text-xs text-muted">{{ t('features.invoices.admin.outstanding') }} {{ money(item.outstandingMinor, item.currency) }}</p></div>
              <div class="flex items-center justify-end gap-2"><UBadge :color="statusColor(item.status)" variant="subtle">{{ t(`features.invoices.admin.invoiceStatus.${item.status.toLowerCase()}`) }}</UBadge><UIcon name="i-lucide-chevron-right" class="size-5 text-muted" /></div>
            </NuxtLink>
          </UCard>
        </div>
      </InvoicesAdminPaginatedList>
    </section>
  </InvoicesPageShell>
</template>
