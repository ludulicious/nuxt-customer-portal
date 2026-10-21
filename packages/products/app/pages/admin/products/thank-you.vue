<script setup lang="ts">
import {
  defaultThankYouCopy,
  resolveThankYouCopy,
  thankYouOverrideSchema,
  type ThankYouText,
  type ThankYouVariant
} from '../../../../shared/thank-you'
import type { CatalogProduct } from '../../../../shared/types'

const { t } = useI18n()
const api = useProducts()
const toast = useToast()
const entries = ref<ThankYouText[]>([])
const error = ref('')
const busy = ref(false)
const previewBusy = ref(false)
const scope = ref<'default' | 'product'>('default')
const locale = ref<'en' | 'nl'>('en')
const variant = ref<ThankYouVariant>('free')
const slugInput = ref('')
const activeSlug = ref('')
const previewSlug = ref('')
const previewProduct = ref<CatalogProduct>()
const empty = () => ({ statusLabel: '', heading: '', message: '', helpText: '', downloadsHeading: '' })
const state = reactive(empty())
const drafts = new Map<string, ThankYouText>()
const target = computed(() => ({
  productSlug: scope.value === 'product' ? activeSlug.value : '',
  locale: locale.value,
  variant: variant.value
}))
const targetKey = computed(() => JSON.stringify(target.value))
const editable = computed(() => scope.value === 'default' || !!activeSlug.value)
const fields = ['statusLabel', 'heading', 'message', 'helpText', 'downloadsHeading'] as const
const schema = useProductFormSchema(thankYouOverrideSchema)
const matches = (a: Omit<ThankYouText, 'copy'>, b: Omit<ThankYouText, 'copy'>) =>
  a.productSlug === b.productSlug && a.locale === b.locale && a.variant === b.variant
try {
  entries.value = await api.thankYouTexts()
} catch {
  error.value = t('products.loadFailed')
}
let previousWasEditable = false
watch(
  () => [targetKey.value, scope.value],
  ([key], previous) => {
    const previousKey = previous?.[0]
    if (previousKey && previousWasEditable) {
      drafts.set(previousKey, { ...JSON.parse(previousKey), copy: { ...state } })
    }
    const saved = drafts.get(key!) || entries.value.find((entry) => matches(entry, target.value))
    Object.assign(
      state,
      scope.value === 'default' ? defaultThankYouCopy(variant.value, locale.value) : empty(),
      saved?.copy || {}
    )
    previousWasEditable = editable.value
  },
  { immediate: true, flush: 'sync' }
)
const effectiveEntries = computed(() => {
  const items = new Map(
    entries.value.map((entry) => [
      JSON.stringify({ productSlug: entry.productSlug, locale: entry.locale, variant: entry.variant }),
      entry
    ])
  )
  for (const [key, entry] of drafts) {
    items.set(key, entry)
  }
  if (editable.value) {
    items.set(targetKey.value, { ...target.value, copy: { ...state } })
  }
  return [...items.values()]
})
const inherited = computed(() =>
  resolveThankYouCopy(
    effectiveEntries.value.filter((entry) => !matches(entry, target.value)),
    target.value.productSlug,
    variant.value,
    locale.value
  )
)
const previewCopy = computed(() =>
  resolveThankYouCopy(effectiveEntries.value, previewProduct.value?.slug || '', variant.value, locale.value)
)
const scopeOptions = computed(() => [
  { value: 'default', label: t('products.thankYouDefault') },
  { value: 'product', label: t('products.thankYouProduct') }
])
const variantOptions = computed(() => [
  { value: 'free', label: t('products.thankYouFree') },
  { value: 'paid', label: t('products.thankYouPaid') }
])
const localeOptions = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' }
]
watch(locale, () => {
  previewProduct.value = undefined
})
async function loadProduct() {
  if (!slugInput.value.trim()) {
    error.value = t('products.thankYouSlugRequired')
    return
  }
  previewBusy.value = true
  previewProduct.value = undefined
  error.value = ''
  try {
    const product = await api.previewThankYou(slugInput.value.trim(), locale.value)
    activeSlug.value = product.slug
    previewSlug.value = product.slug
    previewProduct.value = product
  } catch {
    error.value = t('products.thankYouProductMissing')
  } finally {
    previewBusy.value = false
  }
}
async function preview() {
  if (!previewSlug.value.trim()) {
    error.value = t('products.thankYouSlugRequired')
    return
  }
  previewBusy.value = true
  previewProduct.value = undefined
  error.value = ''
  try {
    previewProduct.value = await api.previewThankYou(previewSlug.value.trim(), locale.value)
  } catch {
    error.value = t('products.thankYouProductMissing')
  } finally {
    previewBusy.value = false
  }
}
async function save() {
  busy.value = true
  error.value = ''
  try {
    const saved = await api.saveThankYouText({ ...target.value, copy: { ...state } })
    entries.value = [...entries.value.filter((entry) => !matches(entry, saved)), saved]
    drafts.delete(targetKey.value)
    toast.add({ title: t('products.saved'), color: 'success' })
  } catch {
    error.value = t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
async function reset() {
  busy.value = true
  error.value = ''
  try {
    await api.resetThankYouText({ ...target.value })
    entries.value = entries.value.filter((entry) => !matches(entry, target.value))
    drafts.delete(targetKey.value)
    Object.assign(state, scope.value === 'default' ? defaultThankYouCopy(variant.value, locale.value) : empty())
    toast.add({ title: t('products.thankYouResetDone'), color: 'success' })
  } catch {
    error.value = t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ProductsShell
    :title="t('products.thankYouTexts')"
    :subtitle="t('products.thankYouIntro')"
    icon="i-lucide-message-square-heart"
  >
    <UAlert v-if="error" color="error" :title="error" class="mb-4" />
    <div class="flex flex-wrap gap-4 rounded-lg border border-default p-4">
      <UFormField :label="t('products.thankYouScope')"
        ><USelect v-model="scope" :items="scopeOptions" :disabled="busy || previewBusy" class="w-56"
      /></UFormField>
      <UFormField :label="t('products.thankYouLanguage')"
        ><USelect v-model="locale" :items="localeOptions" :disabled="busy || previewBusy" class="w-44"
      /></UFormField>
      <UFormField :label="t('products.thankYouVariant')"
        ><USelect v-model="variant" :items="variantOptions" :disabled="busy || previewBusy" class="w-48"
      /></UFormField>
      <div v-if="scope === 'product'" class="flex flex-wrap items-end gap-2">
        <UFormField :label="t('products.slug')"
          ><UInput v-model="slugInput" :disabled="busy || previewBusy" class="w-64 max-w-full"
        /></UFormField>
        <UButton :loading="previewBusy" :disabled="busy" variant="outline" @click="loadProduct">{{
          t('products.thankYouOpenProduct')
        }}</UButton>
      </div>
    </div>
    <div class="mt-4 grid gap-6 xl:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.3fr)]">
      <UForm
        v-if="editable"
        :state="state"
        :schema="schema"
        novalidate
        class="space-y-4 rounded-lg border border-default p-5"
        @submit="save"
      >
        <p class="text-sm text-muted">
          {{
            scope === 'default'
              ? t('products.thankYouDefaultHelp')
              : t('products.thankYouOverrideHelp', { slug: activeSlug })
          }}
        </p>
        <UFormField v-for="field in fields" :key="field" :name="field" :label="t(`products.thankYouFields.${field}`)">
          <UTextarea
            v-if="field === 'message' || field === 'helpText'"
            v-model="state[field]"
            :placeholder="inherited[field]"
            :disabled="busy"
            :rows="field === 'message' ? 5 : 3"
            class="w-full"
          />
          <UInput v-else v-model="state[field]" :placeholder="inherited[field]" :disabled="busy" class="w-full" />
        </UFormField>
        <div class="flex flex-wrap gap-3">
          <UButton type="submit" :loading="busy" icon="i-lucide-save">{{ t('products.save') }}</UButton>
          <UButton type="button" variant="outline" :disabled="busy" @click="reset">{{
            t('products.thankYouReset')
          }}</UButton>
        </div>
      </UForm>
      <p v-else class="text-sm text-muted">{{ t('products.thankYouSlugRequired') }}</p>
      <section class="min-w-0 space-y-4" :aria-label="t('products.thankYouPreview')">
        <div class="flex flex-wrap items-end gap-3">
          <UFormField :label="t('products.thankYouPreviewSlug')"
            ><UInput v-model="previewSlug" :disabled="previewBusy || busy" class="w-64 max-w-full"
          /></UFormField>
          <UButton :loading="previewBusy" :disabled="busy" icon="i-lucide-eye" variant="outline" @click="preview">{{
            t('products.thankYouPreview')
          }}</UButton>
        </div>
        <p class="text-sm text-muted">{{ t('products.thankYouPreviewHelp') }}</p>
        <ProductsOrderReceipt
          v-if="previewProduct"
          :product="previewProduct"
          outcome="success"
          :delivery="{ status: 'paid', files: [{ id: 'sample', name: t('products.thankYouExampleFile'), url: '#' }] }"
          :copy="previewCopy"
          preview
          :preview-variant="variant"
        />
      </section>
    </div>
  </ProductsShell>
</template>
