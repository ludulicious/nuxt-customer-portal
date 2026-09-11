<script setup lang="ts">
import type { z } from 'zod'
import type { settingsSchema } from '../../../../shared/validation'
import { defaultMarkdownStyle } from '../../../../shared/markdown-style'

const { t } = useI18n(),
  api = useProducts(),
  toast = useToast(),
  settings = reactive<z.output<typeof settingsSchema>>({
    markdownStyle: defaultMarkdownStyle(),
    languages: ['en', 'nl'] as ('en' | 'nl')[],
    currencies: ['EUR'],
    currencyTaxBehavior: {} as Record<string, 'inclusive' | 'exclusive'>,
    enabled: false,
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
      languages: health.value.languages,
      currencies: health.value.currencies,
      currencyTaxBehavior: health.value.currencyTaxBehavior,
      enabled: health.value.enabled,
      defaultLocale: health.value.defaultLocale,
      imagePolicy: health.value.imagePolicy
    })
  } catch {
    error.value = t('products.loadFailed')
  }
}
onMounted(load)
async function save(tab: 'general' | 'styles') {
  busy.value = true
  error.value = ''
  try {
    const latest = await api.settings()
    const general = {
      enabled: latest.enabled,
      languages: latest.languages,
      defaultLocale: latest.defaultLocale,
      currencies: latest.currencies,
      currencyTaxBehavior: latest.currencyTaxBehavior,
      imagePolicy: latest.imagePolicy
    }
    await api.saveSettings(
      tab === 'styles'
        ? { ...general, markdownStyle: settings.markdownStyle }
        : { ...settings, markdownStyle: latest.markdownStyle }
    )
    toast.add({ title: t('products.saved'), color: 'success' })
    health.value = await api.settings()
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
const activeTab = ref('general')
const tabs = computed(() => [
  { label: t('products.generalSettings'), value: 'general', slot: 'general' },
  { label: t('products.styles'), value: 'styles', slot: 'styles' },
  { label: t('products.storageTab'), value: 'storage', slot: 'storage' }
])
</script>

<template>
  <ProductsShell :title="t('products.settings')" :subtitle="t('products.settingsIntro')">
    <UAlert v-if="error" color="error" :title="error" />
    <UTabs
      v-model="activeTab"
      :items="tabs"
      variant="link"
      :unmount-on-hide="false"
      :ui="{ list: 'justify-start', trigger: 'grow-0' }"
    >
      <template #general>
        <ProductsGeneralSettings
          :model-value="settings"
          :health="health"
          :saving="busy"
          class="pt-4"
          @save="save('general')"
        />
      </template>
      <template #styles>
        <ProductsStyleSettings :model-value="settings" :saving="busy" class="mt-4" @save="save('styles')" />
      </template>
      <template #storage>
        <ProductsStorageSettings v-if="health" :storage="health.storage" @changed="load" />
      </template>
    </UTabs>
  </ProductsShell>
</template>
