<script setup lang="ts">
import {
  defaultThankYouCopy,
  thankYouMarkdown,
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
const productSearch = ref('')
const productOptions = ref<Array<{ value: string; label: string }>>([])
const productsBusy = ref(false)
const activeSlug = ref('')
const previewSlug = ref('')
const previewProduct = ref<CatalogProduct>()
const empty = () => ({ statusLabel: '', content: '', downloadsHeading: '' })
const editorCopy = (copy: ReturnType<typeof defaultThankYouCopy>) => ({
  statusLabel: copy.statusLabel,
  content: thankYouMarkdown(copy),
  downloadsHeading: copy.downloadsHeading
})
const state = reactive(empty())
const drafts = new Map<string, ThankYouText>()
const target = computed(() => ({
  productSlug: scope.value === 'product' ? activeSlug.value : '',
  locale: locale.value,
  variant: variant.value
}))
const targetKey = computed(() => JSON.stringify(target.value))
const editable = computed(() => scope.value === 'default' || !!activeSlug.value)
const fields = ['statusLabel', 'downloadsHeading'] as const
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
    const baseline = scope.value === 'default' ? editorCopy(defaultThankYouCopy(variant.value, locale.value)) : empty()
    const savedContent =
      saved?.copy.content ??
      (saved && (saved.copy.heading || saved.copy.message || saved.copy.helpText)
        ? thankYouMarkdown(
            resolveThankYouCopy(
              [...entries.value.filter((entry) => !matches(entry, saved)), saved],
              saved.productSlug,
              saved.variant,
              saved.locale
            )
          )
        : baseline.content)
    Object.assign(state, {
      statusLabel: saved?.copy.statusLabel ?? baseline.statusLabel,
      downloadsHeading: saved?.copy.downloadsHeading ?? baseline.downloadsHeading,
      content: savedContent
    })
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
const resolvedPreview = computed(() =>
  resolveThankYouCopy(effectiveEntries.value, previewProduct.value?.slug || '', variant.value, locale.value)
)
const renderedPreview = ref<{ content: string; html: string }>()
const previewCopy = computed(() => {
  const rendered = renderedPreview.value
  return {
    ...resolvedPreview.value,
    contentHtml: rendered && rendered.content === resolvedPreview.value.content ? rendered.html : undefined
  }
})
watch(
  () => resolvedPreview.value.content,
  (content, _, onCleanup) => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const result = await api.renderThankYou(content || '', controller.signal)
        renderedPreview.value = { content: content || '', html: result.html }
      } catch {
        if (!controller.signal.aborted) {
          error.value = t('products.loadFailed')
        }
      }
    }, 200)
    onCleanup(() => {
      clearTimeout(timer)
      controller.abort()
    })
  },
  { immediate: true }
)
watch(
  [productSearch, locale],
  (_, __, onCleanup) => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      productsBusy.value = true
      try {
        const page = await api.list(
          { search: productSearch.value, locale: locale.value, sortBy: 'title', sortDir: 'asc' },
          controller.signal
        )
        productOptions.value = page.items
          .filter((product) => product.slug)
          .map((product) => ({
            value: product.slug,
            label: `${product.content[locale.value].title || product.content.en.title || product.content.nl.title} (${product.slug})`
          }))
      } catch {
        if (!controller.signal.aborted) {
          error.value = t('products.loadFailed')
        }
      } finally {
        if (!controller.signal.aborted) {
          productsBusy.value = false
        }
      }
    }, 150)
    onCleanup(() => {
      clearTimeout(timer)
      controller.abort()
    })
  },
  { immediate: true }
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
    Object.assign(
      state,
      scope.value === 'default' ? editorCopy(defaultThankYouCopy(variant.value, locale.value)) : empty()
    )
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
        <UFormField :label="t('products.thankYouChooseProduct')"
          ><USelectMenu
            v-model="slugInput"
            v-model:search-term="productSearch"
            :items="productOptions"
            value-key="value"
            :ignore-filter="true"
            :loading="productsBusy"
            :disabled="busy || previewBusy"
            :placeholder="t('products.thankYouChooseProduct')"
            class="w-80 max-w-full"
        /></UFormField>
        <UButton :loading="previewBusy" :disabled="busy" variant="outline" @click="loadProduct">{{
          t('products.thankYouOpenProduct')
        }}</UButton>
      </div>
    </div>
    <div class="mt-4 space-y-6">
      <UForm
        v-if="editable"
        :state="state"
        :schema="schema"
        novalidate
        class="space-y-4 rounded-lg border border-default p-5"
        @submit="save"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField v-for="field in fields" :key="field" :name="field" :label="t(`products.thankYouFields.${field}`)">
            <UInput v-model="state[field]" :placeholder="inherited[field]" :disabled="busy" class="w-full" />
          </UFormField>
        </div>
        <UFormField name="content" :label="t('products.thankYouFields.content')">
          <PortalMarkdownEditor
            :key="targetKey"
            v-model="state.content"
            :placeholder="thankYouMarkdown(inherited)"
            :disabled="busy"
            :rows="12"
            class="w-full"
          />
        </UFormField>
        <div class="flex flex-wrap gap-3">
          <UButton type="submit" :loading="busy" icon="i-lucide-save">{{ t('products.save') }}</UButton>
          <UButton type="button" variant="outline" :disabled="busy" @click="reset">{{
            t('products.thankYouReset')
          }}</UButton>
        </div>
      </UForm>
      <section class="min-w-0 space-y-4" :aria-label="t('products.thankYouPreview')">
        <div class="flex flex-wrap items-end gap-3">
          <UFormField :label="t('products.thankYouPreviewSlug')"
            ><USelectMenu
              v-model="previewSlug"
              v-model:search-term="productSearch"
              :items="productOptions"
              value-key="value"
              :ignore-filter="true"
              :loading="productsBusy"
              :disabled="previewBusy || busy"
              :placeholder="t('products.thankYouChooseProduct')"
              class="w-96 max-w-full"
          /></UFormField>
          <UButton :loading="previewBusy" :disabled="busy" icon="i-lucide-eye" variant="outline" @click="preview">{{
            t('products.thankYouPreview')
          }}</UButton>
        </div>
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
