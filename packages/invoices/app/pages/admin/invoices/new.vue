<script setup lang="ts">
const invoices = useInvoices()
const { t } = useI18n()
const { data, refresh } = await useAsyncData('invoice-create-bootstrap', () => invoices.adminBootstrap())
useSeoMeta({ title: () => t('features.invoices.admin.newInvoice') })
</script>

<template>
  <section class="invoice-admin flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
    <header class="mb-6 shrink-0">
      <UButton to="/admin/invoices" color="neutral" variant="link" icon="i-lucide-arrow-left" class="mb-3 px-0">
        {{ t('features.invoices.admin.backToInvoices') }}
      </UButton>
      <h1 class="text-2xl font-semibold">{{ t('features.invoices.admin.newInvoice') }}</h1>
    </header>
    <InvoicesAdminInvoices v-if="data" :data="data" :refresh="refresh" create-page class="min-h-0 flex-1" />
  </section>
</template>
