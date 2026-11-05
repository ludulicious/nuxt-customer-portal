<script setup lang="ts">
import { z } from 'zod'

const api = useInvoices()
const { data, refresh } = await useAsyncData('invoice-settings', () => api.adminBootstrap())
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const general = reactive({ enabled: false, currency: 'EUR', defaultVatRate: 0.21 })
const generalSchema = computed(() =>
  z.object({
    enabled: z.boolean(),
    currency: z.string().trim().toUpperCase().length(3, t('features.invoices.validation.currencyLength')),
    defaultVatRate: z
      .number({ error: t('features.invoices.validation.vatPercentage') })
      .min(0, t('features.invoices.validation.vatPercentage'))
      .max(1, t('features.invoices.validation.vatPercentage'))
  })
)
watch(
  data,
  (value) => {
    if (value) {
      Object.assign(general, {
        enabled: value.settings.enabled,
        currency: value.settings.currency,
        defaultVatRate: value.settings.defaultVatRateBasisPoints / 10_000
      })
    }
  },
  { immediate: true }
)
const saveGeneral = async () => {
  if (!data.value) {
    return
  }
  busy.value = true
  try {
    const validated = generalSchema.value.parse(general)
    const { organizationId: _organizationId, ...settings } = data.value.settings
    await api.updateSettings({
      ...settings,
      enabled: validated.enabled,
      currency: validated.currency,
      defaultVatRateBasisPoints: Math.round(validated.defaultVatRate * 10_000)
    })
    await refresh()
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('invoices:capabilities-refresh'))
    }
    toast.add({ title: t('features.invoices.messages.workspaceSettingsSaved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('features.invoices.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <section class="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header class="flex items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
          <div class="flex min-w-0 gap-3">
            <UIcon name="i-lucide-settings-2" class="mt-1 size-6 shrink-0 text-primary" />
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold text-highlighted">
                {{ t('features.invoices.admin.workspaceSettings') }}
              </h1>
              <p class="hidden text-sm text-muted sm:block">
                {{ t('features.invoices.admin.workspaceSettingsDescription') }}
              </p>
            </div>
          </div>
        </header>
        <UCard v-if="data">
          <template #header>
            <h2 class="font-semibold">{{ t('features.invoices.admin.invoiceConfiguration') }}</h2>
          </template>
          <UForm
            :schema="generalSchema"
            :state="general"
            novalidate
            class="grid gap-4 md:grid-cols-3"
            @submit="saveGeneral"
          >
            <UFormField name="enabled" class="md:col-span-3">
              <USwitch v-model="general.enabled" :label="t('features.invoices.admin.invoicesEnabled')" /> </UFormField
            ><UFormField name="currency" :label="t('features.invoices.admin.currency')">
              <UInput v-model="general.currency" maxlength="3" class="w-full" /> </UFormField
            ><UFormField name="defaultVatRate" :label="t('features.invoices.admin.defaultVatRate')">
              <UInputNumber
                v-model="general.defaultVatRate"
                :min="0"
                :max="1"
                :step="0.0001"
                :format-options="{ style: 'percent', maximumFractionDigits: 2 }"
                :increment="false"
                :decrement="false"
                class="w-full"
              />
            </UFormField>
            <div class="flex items-end justify-end">
              <UButton
                type="submit"
                icon="i-lucide-save"
                class="ml-auto flex min-w-28 justify-center"
                :loading="busy"
                >{{ t('features.invoices.save') }}</UButton
              >
            </div>
          </UForm>
        </UCard>
        <InvoicesSenderDetailsForm
          v-if="data"
          id="sender-invoice-details"
          :profile="data.organizationProfile"
          :refresh="refresh"
        />
      </section>
    </div>
  </div>
</template>
