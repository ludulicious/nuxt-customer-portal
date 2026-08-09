<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const api = useTimesheets()
const invoiceId = computed(() => String(route.params.id))
const { data: invoice, pending, error, refresh } = await useAsyncData(`timesheets-invoice-${invoiceId.value}`, () => api.getInvoice(invoiceId.value))
useSeoMeta({ title: computed(() => invoice.value ? t('features.timesheets.admin.invoiceTitle', { number: invoice.value.number }) : t('features.timesheets.admin.invoices')) })
</script>

<template>
  <TimesheetsPageShell class="timesheet-admin h-full min-h-0 overflow-y-auto">
    <div v-if="pending" class="flex justify-center py-12" role="status"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /><span class="sr-only">{{ t('features.timesheets.loading') }}</span></div>
    <UAlert v-else-if="error" color="error" icon="i-lucide-circle-alert" :title="t('features.timesheets.admin.invoiceNotFound')" variant="outline" />
    <TimesheetsInvoiceDetail v-else-if="invoice" :invoice="invoice" :refresh="refresh" />
  </TimesheetsPageShell>
</template>
