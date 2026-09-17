<script setup lang="ts">
import type { z } from 'zod'
import type { settingsSchema } from '../../../../shared/validation'
import { defaultMarkdownStyle } from '../../../../shared/markdown-style'
import { defaultCheckoutAppearance } from '../../../../shared/checkout-appearance'

const { t } = useI18n(),
  route = useRoute(),
  api = useProducts(),
  toast = useToast(),
  settings = reactive<z.output<typeof settingsSchema>>({
    checkoutAppearance: defaultCheckoutAppearance(),
    markdownStyle: defaultMarkdownStyle(),
    languages: ['en', 'nl'] as ('en' | 'nl')[],
    currencies: ['EUR'],
    currencyTaxBehavior: {} as Record<string, 'inclusive' | 'exclusive'>,
    enabled: false,
    mode: 'sandbox' as const,
    defaultLocale: 'en' as 'en' | 'nl',
    imagePolicy: {
      thumbnail: { width: 400, height: 400 },
      gallery: { width: 800, height: 1000 },
      detail: { width: 1200, height: 900 }
    }
  }),
  error = ref(''),
  busy = ref(false)
const health = ref<Awaited<ReturnType<typeof api.settings>>>()
async function load() {
  try {
    health.value = await api.settings()
    Object.assign(settings, {
      markdownStyle: health.value.markdownStyle,
      checkoutAppearance: health.value.checkoutAppearance,
      languages: health.value.languages,
      currencies: health.value.currencies,
      currencyTaxBehavior: health.value.currencyTaxBehavior,
      enabled: health.value.enabled,
      mode: health.value.mode,
      defaultLocale: health.value.defaultLocale,
      imagePolicy: health.value.imagePolicy
    })
  } catch {
    error.value = t('products.loadFailed')
  }
}
await load()
async function save(tab: 'general' | 'styles') {
  busy.value = true
  error.value = ''
  try {
    const latest = await api.settings()
    const general = {
      enabled: latest.enabled,
      mode: latest.mode,
      languages: latest.languages,
      defaultLocale: latest.defaultLocale,
      currencies: latest.currencies,
      currencyTaxBehavior: latest.currencyTaxBehavior,
      imagePolicy: latest.imagePolicy,
      checkoutAppearance: latest.checkoutAppearance
    }
    await api.saveSettings(
      tab === 'styles'
        ? { ...general, markdownStyle: settings.markdownStyle, checkoutAppearance: settings.checkoutAppearance }
        : { ...settings, markdownStyle: latest.markdownStyle }
    )
    toast.add({ title: t('products.saved'), color: 'success' })
    health.value = await api.settings()
  } catch (e) {
    const failure = e as { data?: { message?: string }; message?: string }
    error.value = failure.data?.message || failure.message || t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
const tabs = computed(() => [
  { label: t('products.generalSettings'), value: '/admin/products/settings' },
  { label: t('products.styles'), value: '/admin/products/settings/styles' },
  ...(health.value?.stripe.source === 'environment'
    ? []
    : [{ label: t('products.stripeTab'), value: '/admin/products/settings/stripe' }]),
  { label: t('products.storageTab'), value: '/admin/products/settings/storage' }
])
const activeTab = computed(() => route.path.replace(/\/$/, '') || '/admin/products/settings')
function selectTab(value: string | number) {
  return navigateTo(String(value))
}
</script>

<template>
  <ProductsShell :title="t('products.settings')" :subtitle="t('products.settingsIntro')">
    <UAlert v-if="error" color="error" :title="error" />
    <UTabs
      :model-value="activeTab"
      :items="tabs"
      :content="false"
      variant="link"
      :ui="{ list: 'justify-start', trigger: 'grow-0' }"
      @update:model-value="selectTab"
    />
    <NuxtPage
      :settings="settings"
      :health="health"
      :saving="busy"
      @save-general="save('general')"
      @save-styles="save('styles')"
      @changed="load"
    />
  </ProductsShell>
</template>
