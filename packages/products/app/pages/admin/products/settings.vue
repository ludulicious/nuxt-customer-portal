<script setup lang="ts">
import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'
import { settingsSchema, keySchema, productCurrencies } from '../../../../shared/validation'

const currencyOptions: string[] = [...productCurrencies]
const { t } = useI18n(),
  api = useProducts(),
  toast = useToast(),
  settings = reactive({
    languages: ['en', 'nl'] as ('en' | 'nl')[],
    currencies: ['EUR'] as string[],
    currencyTaxBehavior: {} as Record<string, 'inclusive' | 'exclusive'>,
    enabled: false,
    defaultLocale: 'en' as 'en' | 'nl'
  }),
  keyState = reactive({ name: '', expiresAt: null as string | null }),
  expiry = ref(''),
  shownKey = ref(''),
  error = ref(''),
  busy = ref(false),
  revoking = ref('')
const schema = useProductFormSchema(settingsSchema),
  apiSchema = useProductFormSchema(keySchema),
  keys = ref<Awaited<ReturnType<typeof api.keys>>>([]),
  health = ref<Awaited<ReturnType<typeof api.settings>>>()
const taxOptions = computed(() => ['inclusive', 'exclusive'].map((value) => ({ value, label: t(`products.${value}`) })))
watch(
  () => settings.currencies,
  (currencies) => {
    for (const currency of currencies) {
      settings.currencyTaxBehavior[currency] ||= 'inclusive'
    }
  },
  { immediate: true, deep: true }
)
const defaultLanguageOptions = computed(() =>
  portalLanguages.filter((language) => settings.languages.includes(language.value))
)
watch(
  () => settings.languages,
  (languages) => {
    if (languages.length && !languages.includes(settings.defaultLocale)) {
      settings.defaultLocale = languages[0]!
    }
  }
)
async function load() {
  try {
    health.value = await api.settings()
    Object.assign(settings, {
      languages: health.value.languages,
      currencies: health.value.currencies,
      currencyTaxBehavior: health.value.currencyTaxBehavior,
      enabled: health.value.enabled,
      defaultLocale: health.value.defaultLocale
    })
    keys.value = await api.keys()
  } catch {
    error.value = t('products.loadFailed')
  }
}
onMounted(load)
async function save() {
  busy.value = true
  error.value = ''
  try {
    await api.saveSettings(settings)
    toast.add({ title: t('products.saved'), color: 'success' })
    await load()
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
async function createKey() {
  busy.value = true
  error.value = ''
  try {
    shownKey.value = (
      await api.createKey({ ...keyState, expiresAt: expiry.value ? new Date(expiry.value).toISOString() : null })
    ).key
    keyState.name = ''
    keys.value = await api.keys()
  } catch {
    error.value = t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
async function revoke() {
  await api.revoke(revoking.value)
  revoking.value = ''
  keys.value = await api.keys()
}
</script>

<template>
  <ProductsShell :title="t('products.settings')" :subtitle="t('products.settingsIntro')"
    ><UAlert v-if="error" color="error" :title="error" /><UForm
      :state="settings"
      :schema="schema"
      novalidate
      class="space-y-4 rounded-lg border p-5"
      @submit="save"
      ><UFormField name="enabled" :label="t('products.storeEnabled')"
        ><USwitch v-model="settings.enabled"
      /></UFormField>
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
      <ul class="space-y-1 text-sm">
        <li>Stripe: {{ t(health?.stripeConfigured ? 'products.configured' : 'products.missing') }}</li>
        <li>
          {{ t('products.webhook') }}: {{ t(health?.webhookConfigured ? 'products.configured' : 'products.missing') }}
        </li>
        <li>
          {{ t('products.storage') }}: {{ t(health?.storageConfigured ? 'products.configured' : 'products.missing') }}
        </li>
      </ul>
      <p class="text-sm text-muted">{{ t('products.configHelp') }}</p>
      <UButton type="submit" :loading="busy">{{ t('products.save') }}</UButton></UForm
    >
    <h2 class="text-xl font-semibold">{{ t('products.apiKeys') }}</h2>
    <p class="text-muted">{{ t('products.keyHelp') }}</p>
    <UAlert v-if="shownKey" :title="t('products.copyKey')"
      ><template #description
        ><code class="break-all select-all">{{ shownKey }}</code
        ><UButton class="ml-3" variant="ghost" @click="shownKey = ''">{{ t('products.close') }}</UButton></template
      ></UAlert
    ><UForm :state="keyState" :schema="apiSchema" novalidate class="flex flex-wrap items-end gap-3" @submit="createKey"
      ><UFormField name="name" :label="t('products.websiteName')"><UInput v-model="keyState.name" /></UFormField
      ><UFormField name="expiresAt" :label="t('products.expires')"
        ><UInput v-model="expiry" type="datetime-local" /></UFormField
      ><UButton type="submit" :loading="busy">{{ t('products.createKey') }}</UButton></UForm
    >
    <div v-for="key in keys" :key="key.id" class="rounded-lg border p-4">
      <div class="flex justify-between">
        <div>
          <strong>{{ key.name }}</strong>
          <p class="text-sm text-muted">
            {{ key.prefix }}… ·
            {{ key.last_used_at ? new Date(key.last_used_at).toLocaleString() : t('products.neverUsed') }}
          </p>
          <p v-if="key.revoked_at">{{ t('products.revoked') }}</p>
        </div>
        <UButton v-if="!key.revoked_at" variant="outline" color="neutral" @click="revoking = key.id">{{
          t('products.revoke')
        }}</UButton>
      </div>
      <div v-if="revoking === key.id" class="mt-3 flex flex-wrap items-center gap-3">
        <p>{{ t('products.revokeConfirm', { name: key.name }) }}</p>
        <UButton variant="outline" color="neutral" @click="revoking = ''">{{ t('products.cancel') }}</UButton
        ><UButton color="error" @click="revoke">{{ t('products.revoke') }}</UButton>
      </div>
    </div></ProductsShell
  >
</template>
