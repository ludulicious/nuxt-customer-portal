<script setup lang="ts">
import type { InvoicesListResponse } from '@nuxt-customer-portal/invoices/shared/types/invoice'

const props = defineProps<{ section: 'salesInvoices' | 'receivedInvoices' }>()
const { t } = useI18n()
const sales = props.section === 'salesInvoices'
const endpoint = sales ? '/api/invoices/admin/invoices' : '/api/invoices/client/invoices'
const { data, pending } = await useFetch<InvoicesListResponse<unknown>>(endpoint, { query: { pageSize: 1 } })
const total = computed(() => data.value?.pagination.total ?? 0)
</script>

<template>
  <UCard>
    <div class="flex items-center justify-between gap-4"><div><p class="text-sm text-muted">{{ t(sales ? 'features.invoices.salesInvoices' : 'features.invoices.receivedInvoices') }}</p><p class="mt-1 text-3xl font-semibold">{{ pending ? '…' : total }}</p></div><UButton :to="sales ? '/admin/invoices' : '/invoices'" variant="outline" icon="i-lucide-arrow-right">{{ t('features.invoices.dashboard.open') }}</UButton></div>
  </UCard>
</template>
