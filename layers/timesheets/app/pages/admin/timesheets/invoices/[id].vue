<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const api = useTimesheets()
const invoiceId = computed(() => String(route.params.id))
const { data: invoice, pending, error, refresh } = await useAsyncData(`timesheets-invoice-${invoiceId.value}`, () => api.getInvoice(invoiceId.value))
useSeoMeta({ title: computed(() => invoice.value ? t('features.timesheets.admin.invoiceTitle', { number: invoice.value.number }) : t('features.timesheets.admin.invoices')) })
</script>

<template>
  <div class="timesheet-admin mx-auto h-full min-h-0 w-full max-w-[1440px] overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
    <div v-if="pending" class="flex justify-center py-12" role="status"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /><span class="sr-only">{{ t('features.timesheets.loading') }}</span></div>
    <UAlert v-else-if="error" color="error" icon="i-lucide-circle-alert" :title="t('features.timesheets.admin.invoiceNotFound')" />
    <TimesheetsInvoiceDetail v-else-if="invoice" :invoice="invoice" :refresh="refresh" />
  </div>
</template>
