<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const api = useInvoices()
const invoiceId = computed(() => String(route.params.id))
const { data: invoice, pending, error, refresh } = await useAsyncData(`client-invoice-${invoiceId.value}`, () => api.getClientInvoice(invoiceId.value))
useSeoMeta({ title: computed(() => invoice.value ? t('features.invoices.admin.invoiceTitle', { number: invoice.value.number }) : t('features.invoices.clientInvoices.title')) })
</script>

<template>
  <InvoicesPageShell class="h-full min-h-0 overflow-y-auto">
    <div v-if="pending" class="flex justify-center py-12" role="status"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /><span class="sr-only">{{ t('features.invoices.loading') }}</span></div>
    <UAlert v-else-if="error" color="error" icon="i-lucide-circle-alert" :title="t('features.invoices.admin.invoiceNotFound')" variant="outline" />
    <InvoicesInvoiceDetail v-else-if="invoice" :invoice="invoice" :refresh="refresh" mode="client" />
  </InvoicesPageShell>
</template>
