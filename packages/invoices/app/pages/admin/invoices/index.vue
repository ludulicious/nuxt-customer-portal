<script setup lang="ts">
const invoices = useInvoices()
const child = ref<{ openCreate: () => void, refreshList: () => Promise<unknown>, canCreate: boolean, showCreate: boolean } | null>(null)
const { data, pending, refresh } = await useAsyncData('invoices-admin', () => invoices.adminBootstrap())
const { t } = useI18n()
useSeoMeta({ title: () => t('features.invoices.salesInvoices') })
</script>

<template>
  <section class="invoice-admin flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex shrink-0 items-end justify-between gap-4">
      <div><h1 class="text-2xl font-semibold">{{ t('features.invoices.salesInvoices') }}</h1><p class="mt-1 hidden text-sm text-muted sm:block">{{ t('features.invoices.admin.sectionSubtitles.invoices') }}</p></div>
      <div class="flex gap-1"><UButton v-if="child?.showCreate" class="rounded-full sm:hidden" icon="i-lucide-plus" :aria-label="t('features.invoices.admin.newInvoice')" :disabled="!child.canCreate" @click="child.openCreate()" /><UButton v-if="child?.showCreate" class="hidden sm:inline-flex" icon="i-lucide-plus" size="sm" variant="outline" :disabled="!child.canCreate" @click="child.openCreate()">{{ t('features.invoices.admin.newInvoice') }}</UButton><UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="sm" :aria-label="t('common.refresh')" @click="() => refresh()" /></div>
    </header>
    <div v-if="pending && !data" class="flex justify-center py-12"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
    <InvoicesAdminInvoices v-if="data" ref="child" :data="data" :refresh="refresh" class="min-h-0 flex-1" />
  </section>
</template>
