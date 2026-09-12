<script setup lang="ts">
import { z } from 'zod'
import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'
import { settingsSchema, productCurrencies } from '../../shared/validation'

const settings = defineModel<z.output<typeof settingsSchema>>({ required: true })
const props = defineProps<{
  health?: Awaited<ReturnType<ReturnType<typeof useProducts>['settings']>>
  saving: boolean
}>()
const emit = defineEmits<{ save: [] }>()
const currencyOptions = [...productCurrencies]
const { t } = useI18n()
const modeOptions = computed(() => [
  { value: 'sandbox', label: t('products.sandboxMode') },
  { value: 'live', label: t('products.liveMode') }
])
const schema = useProductFormSchema(settingsSchema.safeExtend({ markdownStyle: z.any().optional() }))
const health = computed(() => props.health)
const taxOptions = computed(() => ['inclusive', 'exclusive'].map((value) => ({ value, label: t(`products.${value}`) })))
watch(
  () => settings.value.currencies,
  (currencies) => {
    for (const currency of currencies) {
      settings.value.currencyTaxBehavior[currency] ||= 'inclusive'
    }
  },
  { immediate: true, deep: true }
)
const defaultLanguageOptions = computed(() =>
  portalLanguages.filter((language) => settings.value.languages.includes(language.value))
)
const imagePurposes = ['thumbnail', 'gallery', 'detail'] as const
watch(
  () => settings.value.languages,
  (languages) => {
    if (languages.length && !languages.includes(settings.value.defaultLocale)) {
      settings.value.defaultLocale = languages[0]!
    }
  }
)
function save() {
  emit('save')
}
</script>

<template>
  <div class="space-y-4">
    <UForm :state="settings" :schema="schema" novalidate class="space-y-4 rounded-lg border p-5" @submit="save"
      ><UFormField name="enabled" :label="t('products.storeEnabled')"
        ><USwitch v-model="settings.enabled"
      /></UFormField>
      <UFormField name="mode" :label="t('products.storeMode')" :help="t('products.storeModeHelp')">
        <USelect v-model="settings.mode" :items="modeOptions" class="w-full sm:w-80" />
      </UFormField>
      <UFormField name="languages" :label="t('products.supportedLanguages')" :help="t('products.languagesHelp')">
        <USelectMenu
          v-model="settings.languages"
          :items="portalLanguages"
          value-key="value"
          multiple
          class="w-full sm:w-80"
        />
      </UFormField>
      <UFormField name="defaultLocale" :label="t('products.defaultLanguage')"
        ><USelect v-model="settings.defaultLocale" :items="defaultLanguageOptions" class="w-full sm:w-80"
      /></UFormField>
      <UFormField name="currencies" :label="t('products.supportedCurrencies')" :help="t('products.currenciesHelp')">
        <USelectMenu v-model="settings.currencies" :items="currencyOptions" multiple class="w-full sm:w-80" />
      </UFormField>
      <div class="space-y-3">
        <p class="text-sm text-muted">{{ t('products.currencyTaxHelp') }}</p>
        <UFormField
          v-for="currency in settings.currencies"
          :key="currency"
          :name="`currencyTaxBehavior.${currency}`"
          :label="`${currency} — ${t('products.tax')}`"
        >
          <USelect v-model="settings.currencyTaxBehavior[currency]" :items="taxOptions" class="w-full sm:w-80" />
        </UFormField>
      </div>
      <fieldset class="space-y-3 rounded-md border p-4">
        <legend class="px-1 font-medium">{{ t('products.imageRequirements') }}</legend>
        <p class="text-sm text-muted">{{ t('products.imageRequirementsHelp') }}</p>
        <div class="grid gap-4 lg:grid-cols-3">
          <fieldset v-for="purpose in imagePurposes" :key="purpose" class="space-y-3 rounded-md bg-elevated/40 p-3">
            <legend class="px-1 text-sm font-medium">{{ t(`products.imagePurpose${purpose}`) }}</legend>
            <UFormField :name="`imagePolicy.${purpose}.width`" :label="t('products.width')">
              <UInputNumber v-model="settings.imagePolicy[purpose].width" :min="200" :max="2400" class="w-full" />
            </UFormField>
            <UFormField :name="`imagePolicy.${purpose}.height`" :label="t('products.height')">
              <UInputNumber v-model="settings.imagePolicy[purpose].height" :min="200" :max="2400" class="w-full" />
            </UFormField>
          </fieldset>
        </div>
      </fieldset>
      <ul class="space-y-1 text-sm">
        <li v-if="settings.mode === 'live'">Stripe: {{ t(health?.stripeConfigured ? 'products.configured' : 'products.missing') }}</li>
        <li v-if="settings.mode === 'live'">
          {{ t('products.webhook') }}: {{ t(health?.webhookConfigured ? 'products.configured' : 'products.missing') }}
        </li>
        <li>
          {{ t('products.storage') }}: {{ t(health?.storageConfigured ? 'products.configured' : 'products.missing') }}
        </li>
      </ul>
      <p class="text-sm text-muted">{{ t(settings.mode === 'live' ? 'products.configHelp' : 'products.sandboxConfigHelp') }}</p>

      <UButton type="submit" :loading="saving">{{ t('products.save') }}</UButton></UForm
    >
  </div>
</template>
