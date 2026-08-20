<script setup lang="ts">
defineOptions({ name: 'AdminInvoiceDetailPage' })

const route = useRoute()
const { t } = useI18n()
const api = useInvoices()
const invoiceId = computed(() => String(route.params.id))
const { data: invoice, pending, error, refresh } = await useAsyncData(`invoice-${invoiceId.value}`, () => api.getInvoice(invoiceId.value))
useSeoMeta({ title: computed(() => invoice.value ? t('features.invoices.admin.invoiceTitle', { number: invoice.value.number }) : t('features.invoices.salesInvoices')) })
</script>

<template>
  <section class="h-full min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
    </div>
    <UAlert v-else-if="error" color="error" icon="i-lucide-circle-alert" :title="t('features.invoices.admin.invoiceNotFound')" />
    <InvoicesInvoiceDetail v-else-if="invoice" :invoice="invoice" :refresh="refresh" />
  </section>
</template>
