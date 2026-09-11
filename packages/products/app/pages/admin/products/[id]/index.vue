<script setup lang="ts">
import { hasRequiredPrices } from '../../../../../shared/validation'
import type { ProductPreview, Locale } from '../../../../../shared/types'

definePageMeta({ key: (route) => route.path })
const { t } = useI18n()
const route = useRoute()
const api = useProducts()
const preview = ref<ProductPreview>()
const editing = ref<'basic' | 'details' | 'pricing' | 'media' | null>(route.query.edit === 'true' ? 'basic' : null)
const toast = useToast()
const pending = ref(true),
  error = ref('')
const language = ref<Locale>('en')
const currency = ref('')
const product = computed(() => preview.value?.product)
const productName = computed(() => {
  const content = product.value?.content
  return (
    content?.[preview.value?.defaultLocale || 'en'].title.trim() ||
    content?.en.title.trim() ||
    content?.nl.title.trim() ||
    product.value?.slug ||
    t('products.loading')
  )
})
const copy = computed(() => preview.value?.content[language.value])
const languageOptions = computed(() => {
  const first = preview.value?.defaultLocale || 'en'
  return ([first, first === 'en' ? 'nl' : 'en'] as Locale[])
    .filter((value) => preview.value?.languages.includes(value))
    .map((value) => ({
      value,
      label: value === 'en' ? '🇺🇸 English' : '🇳🇱 Nederlands'
    }))
})
const currencyOptions = computed(() => [...new Set(product.value?.prices.map((price) => price.currency) || [])])
const selectedPrice = computed(() => product.value?.prices.find((price) => price.currency === currency.value))
const backTarget = computed(() => ({ path: '/admin/products', query: route.query }))
function toggleEdit(section: 'basic' | 'details' | 'pricing' | 'media') {
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
  <ProductsShell :title="productName" :subtitle="t('products.previewIntro')">
    <template #back
      ><UButton :to="backTarget" variant="link" color="neutral" icon="i-lucide-arrow-left" class="w-fit px-0">{{
        t('products.backToProducts')
      }}</UButton></template
    >
    <template v-if="product" #actions>
      <ProductsDelete :product="product" @deleted="navigateTo(backTarget)" />
    </template>
    <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    <UAlert v-else-if="error" color="error" :title="error" />
    <template v-else-if="product && copy">
      <UAlert
        v-if="!hasRequiredPrices(product, preview?.currencies || [])"
        color="warning"
        :title="t('products.requiredPrices')"
      />
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
      </div>
      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ProductsPreviewCard
          v-model:language="language"
          class="lg:self-stretch"
          :languages="languageOptions"
          :product="product"
          :copy="copy"
          :editing="editing === 'basic'"
          @edit="toggleEdit('basic')"
        >
          <template #editor>
            <ProductsForm
              :key="`basic-${product.updatedAt}-${language}`"
              :product="product"
              :language="language"
              section="basic"
              @saved="saved"
              @cancel="editing = null"
            />
          </template>
        </ProductsPreviewCard>
        <div class="space-y-6">
          <ProductsDetailsCard
            :product="product"
            :language="language"
            :editing="editing === 'details'"
            @edit="toggleEdit('details')"
            @saved="saved"
          >
            <template #editor>
              <ProductsForm
                :key="`details-${product.updatedAt}`"
                :product="product"
                section="details"
                @saved="saved"
                @cancel="editing = null"
              />
            </template>
          </ProductsDetailsCard>
          <ProductsPriceCard
            v-model:currency="currency"
            :currencies="currencyOptions"
            :price="selectedPrice"
            :language="language"
            :editing="editing === 'pricing'"
            @edit="toggleEdit('pricing')"
          >
            <template #editor>
              <ProductsForm
                :key="`pricing-${product.updatedAt}-${currency}`"
                :product="product"
                :currency="currency"
                section="pricing"
                @saved="saved"
                @cancel="editing = null"
              />
            </template>
          </ProductsPriceCard>
        </div>
      </div>
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
