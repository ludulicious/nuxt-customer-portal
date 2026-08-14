<script setup lang="ts">
const api = useInvoices()
const { data, refresh } = await useAsyncData('invoice-settings', () => api.adminBootstrap())
const { t } = useI18n()
const busy = ref(false)
const general = reactive({ enabled: false, currency: 'EUR', defaultVatRate: 21 })
watch(data, value => {
  if (value) Object.assign(general, { enabled: value.settings.enabled, currency: value.settings.currency, defaultVatRate: value.settings.defaultVatRateBasisPoints / 100 })
}, { immediate: true })
const saveGeneral = async () => {
  if (!data.value) return
  busy.value = true
  try {
    const { organizationId: _organizationId, ...settings } = data.value.settings
    await api.updateSettings({ ...settings, enabled: general.enabled, currency: general.currency.toUpperCase(), defaultVatRateBasisPoints: Math.round(general.defaultVatRate * 100) })
    await refresh()
    if (import.meta.client) window.dispatchEvent(new CustomEvent('invoices:capabilities-refresh'))
  } finally { busy.value = false }
}
</script>

<template>
  <section class="space-y-6">
    <header><h1 class="text-2xl font-semibold">{{ t('features.invoices.settings') }}</h1></header>
    <UCard v-if="data"><template #header><h2 class="font-semibold">{{ t('features.invoices.admin.invoiceConfiguration') }}</h2></template><form class="grid gap-4 md:grid-cols-3" @submit.prevent="saveGeneral"><UFormField class="md:col-span-3"><USwitch v-model="general.enabled" :label="t('features.invoices.admin.invoicesEnabled')" /></UFormField><UFormField :label="t('features.invoices.admin.currency')"><UInput v-model="general.currency" maxlength="3" class="w-full" /></UFormField><UFormField :label="t('features.invoices.admin.defaultVatRate')"><UInputNumber v-model="general.defaultVatRate" :min="0" :max="100" :step="0.01" class="w-full" /></UFormField><div class="flex items-end justify-end"><UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('features.invoices.save') }}</UButton></div></form></UCard>
    <InvoicesSenderDetailsForm v-if="data" id="sender-invoice-details" :profile="data.organizationProfile" :refresh="refresh" />
  </section>
</template>
