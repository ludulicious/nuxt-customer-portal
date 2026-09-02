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
  <UCard class="h-full">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">
          {{ t(sales ? 'features.invoices.salesInvoices' : 'features.invoices.receivedInvoices') }}
        </h2>
        <UIcon :name="sales ? 'i-lucide-receipt-text' : 'i-lucide-inbox'" class="size-5 text-primary" />
      </div>
    </template>
    <div class="flex items-end justify-between gap-4">
      <p class="text-3xl font-semibold tabular-nums">{{ pending ? '…' : total }}</p>
      <UButton :to="sales ? '/admin/invoices' : '/invoices'" variant="outline" icon="i-lucide-arrow-right">
        {{ t('features.invoices.dashboard.open') }}
      </UButton>
    </div>
  </UCard>
</template>
