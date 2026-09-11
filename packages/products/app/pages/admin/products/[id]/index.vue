<script setup lang="ts">
import { hasRequiredPrices } from '../../../../../shared/validation'
import type { ProductPreview, Locale } from '../../../../../shared/types'

definePageMeta({ key: (route) => route.path })
const { t } = useI18n()
const route = useRoute()
const api = useProducts()
const preview = ref<ProductPreview>()
const editing = ref<'basic' | 'pricing' | 'media' | null>(route.query.edit === 'true' ? 'basic' : null)
const toast = useToast()
const pending = ref(true),
  error = ref('')
const language = ref<Locale>('en')
const currency = ref('')
const product = computed(() => preview.value?.product)
const copy = computed(() => preview.value?.content[language.value])
const languageOptions = computed(() => {
  const first = preview.value?.defaultLocale || 'en'
  return ([first, first === 'en' ? 'nl' : 'en'] as Locale[])
    .filter((value) => preview.value?.languages.includes(value) && product.value?.content[value].title.trim())
    .map((value) => ({
      value,
      label: value === 'en' ? '🇺🇸 English' : '🇳🇱 Nederlands'
    }))
})
const currencyOptions = computed(() => [...new Set(product.value?.prices.map((price) => price.currency) || [])])
const selectedPrice = computed(() => product.value?.prices.find((price) => price.currency === currency.value))
const backTarget = computed(() => ({ path: '/admin/products', query: route.query }))
function toggleEdit(section: 'basic' | 'pricing' | 'media') {
  editing.value = editing.value === section ? null : section
}
async function saved() {
  editing.value = null
  try {
    preview.value = await api.preview(String(route.params.id))
    if (!currencyOptions.value.includes(currency.value)) {
      currency.value = currencyOptions.value[0] || ''
    }
    if (!languageOptions.value.some((item) => item.value === language.value)) {
      language.value = languageOptions.value[0]?.value || preview.value.defaultLocale
    }
    toast.add({ title: t('products.saved'), color: 'success' })
  } catch {
    error.value = t('products.loadFailed')
  }
}
onMounted(async () => {
  try {
    preview.value = await api.preview(String(route.params.id))
    language.value = (languageOptions.value[0]?.value || preview.value.defaultLocale) as Locale
    currency.value = currencyOptions.value.includes('EUR') ? 'EUR' : currencyOptions.value[0] || ''
  } catch {
    error.value = t('products.loadFailed')
  } finally {
    pending.value = false
  }
})
</script>

<template>
  <ProductsShell :title="copy?.title || t('products.preview')" :subtitle="t('products.previewIntro')">
    <template #back
      ><UButton :to="backTarget" variant="link" color="neutral" icon="i-lucide-arrow-left" class="w-fit px-0">{{
        t('products.backToProducts')
      }}</UButton></template
    >
    <template v-if="product" #actions>
      <ProductsDelete :product="product" @deleted="navigateTo(backTarget)" />
      <UButton
        variant="outline"
        icon="i-lucide-pencil"
        :aria-expanded="editing === 'basic'"
        @click="toggleEdit('basic')"
        >{{ t('products.edit') }}</UButton
      >
    </template>
    <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    <UAlert v-else-if="error" color="error" :title="error" />
    <template v-else-if="product && copy">
      <UAlert
        v-if="!hasRequiredPrices(product, preview?.currencies || [])"
        color="warning"
        :title="t('products.requiredPrices')"
      />
      <UCard v-if="editing === 'basic'">
        <template #header
          ><div class="flex items-center justify-between">
            <h2 class="font-semibold">{{ t('products.basicDetails') }}</h2>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              :aria-label="t('products.close')"
              @click="editing = null"
            /></div
        ></template>
        <ProductsForm
          :key="`basic-${product.updatedAt}`"
          :product="product"
          section="basic"
          @saved="saved"
          @cancel="editing = null"
        />
      </UCard>
      <div class="flex flex-wrap items-center gap-2">
        <UBadge :color="product.status === 'published' ? 'success' : 'neutral'" variant="subtle">{{
          t(`products.${product.status}`)
        }}</UBadge>
        <span class="text-sm text-muted"
          >{{ t(`products.${product.type}`)
          }}<span v-if="product.categoryId">
            · {{ product.categoryContent?.[language]?.name || product.categoryName || product.categoryId }}</span
          ></span
        >
        <div v-if="languageOptions.length > 1 || currencyOptions.length > 1" class="ml-auto flex items-center gap-2">
          <USelect
            v-if="languageOptions.length > 1"
            v-model="language"
            :items="languageOptions"
            size="sm"
            :aria-label="t('products.contentLanguage')"
            class="w-36"
          />
          <USelect
            v-if="currencyOptions.length > 1"
            v-model="currency"
            :items="currencyOptions"
            size="sm"
            :aria-label="t('products.currency')"
            class="w-24"
          />
        </div>
      </div>
      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ProductsPreviewCard :product="product" :copy="copy" />
        <ProductsPriceCard
          :price="selectedPrice"
          :language="language"
          :editing="editing === 'pricing'"
          @edit="toggleEdit('pricing')"
        />
      </div>
      <UCard v-if="editing === 'pricing'">
        <template #header
          ><h2 class="font-semibold">{{ t('products.editPrices') }}</h2></template
        >
        <ProductsForm
          :key="`pricing-${product.updatedAt}`"
          :product="product"
          section="pricing"
          @saved="saved"
          @cancel="editing = null"
        />
      </UCard>
      <ProductsMediaSection
        :product="product"
        :editing="editing === 'media'"
        @edit="toggleEdit('media')"
        @saved="saved"
        @cancel="editing = null"
      />
    </template>
  </ProductsShell>
</template>
