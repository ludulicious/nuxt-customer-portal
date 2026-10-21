<script setup lang="ts">
import {
  defaultOrderPageCopy,
  resolveOrderPageCopy,
  resolveProductOrderPageCopy,
  orderPageOverrideSchema,
  orderPageTextGroups,
  type OrderPageCopy,
  type OrderPageOverride,
  type PageText
} from '../../shared/page-texts'
import type { PublicOrderDetails } from '../../shared/public-order'
import { defaultCheckoutAppearance } from '../../shared/checkout-appearance'

const props = defineProps<{ locale: 'en' | 'nl' }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const { t } = useI18n()
const api = useProducts()
const toast = useToast()
const schema = useProductFormSchema(orderPageOverrideSchema)
const entries = ref<PageText[]>([])
const appearance = ref(defaultCheckoutAppearance())
const error = ref('')
const busy = ref(false)
const loadFailed = ref(false)
const state = reactive<Required<OrderPageOverride>>(defaultOrderPageCopy(props.locale))
const drafts = new Map<string, OrderPageOverride>()
const scope = ref<'default' | 'product'>('default')
const activeSlug = ref('')
const slugInput = ref('')
const previewSlug = ref('')
const loadedPreviewSlug = ref('')
const productSearch = ref('')
const productOptions = ref<Array<{ value: string; label: string }>>([])
const productsBusy = ref(false)
const previewBusy = ref(false)
const productPreview = ref<PublicOrderDetails>()
const target = computed(() => ({
  page: 'order-details' as const,
  locale: props.locale,
  productSlug: scope.value === 'product' ? activeSlug.value : ''
}))
const targetKey = computed(() => JSON.stringify(target.value))
const editable = computed(() => scope.value === 'default' || !!activeSlug.value)
const scopeOptions = computed(() => [
  { value: 'default', label: t('products.thankYouDefault') },
  { value: 'product', label: t('products.thankYouProduct') }
])
const effectiveEntries = computed(() => {
  const all = new Map(
    entries.value.map((entry) => [
      JSON.stringify({ page: entry.page, locale: entry.locale, productSlug: entry.productSlug }),
      entry
    ])
  )
  for (const [key, copy] of drafts) {
    all.set(key, { ...JSON.parse(key), copy })
  }
  if (editable.value) {
    all.set(targetKey.value, { ...target.value, copy: { ...state } })
  }
  return [...all.values()]
})
const previewState = ref<'paid' | 'accepted' | 'pending' | 'revoked' | 'failed' | 'expired' | 'missing' | 'error'>(
  'paid'
)
const rendered = ref<{ content: string; html: string }>()
const defaults = computed(() => resolveProductOrderPageCopy(entries.value, '', props.locale))
const copy = computed<OrderPageCopy>(() => {
  const resolved = resolveProductOrderPageCopy(
    effectiveEntries.value,
    productPreview.value ? loadedPreviewSlug.value : target.value.productSlug,
    props.locale
  )
  return { ...resolved, contentHtml: rendered.value?.content === resolved.content ? rendered.value.html : '' }
})
const savedOverride = computed(() =>
  entries.value.some(
    (item) =>
      item.locale === props.locale && item.productSlug === target.value.productSlug && Object.keys(item.copy).length
  )
)
const longFields = new Set([
  'invoiceHelp',
  'externalVideoHelp',
  'filePlaybackFailed',
  'externalPlaybackFailed',
  'filesPreparing',
  'pendingText',
  'accessText',
  'itemRevokedText',
  'unavailableText',
  'errorText',
  'footer'
])
watch([busy, previewBusy], ([saving, loading]) => emit('busy', saving || loading), { immediate: true })
try {
  const [texts, settings] = await Promise.all([api.pageTexts(), api.settings()])
  entries.value = texts
  appearance.value = settings.checkoutAppearance
} catch {
  error.value = t('products.loadFailed')
  loadFailed.value = true
}
watch(
  targetKey,
  (key, previous) => {
    if (previous) {
      drafts.set(previous, structuredClone(toRaw(state)))
    }
    const saved = entries.value.find(
      (entry) => entry.locale === props.locale && entry.productSlug === target.value.productSlug
    )?.copy
    const baseline =
      scope.value === 'default'
        ? resolveOrderPageCopy(saved, props.locale)
        : Object.fromEntries(
            Object.keys(defaultOrderPageCopy(props.locale)).map((key) => [
              key,
              saved?.[key as keyof OrderPageOverride] || ''
            ])
          )
    Object.assign(state, drafts.get(key) || baseline)
  },
  { immediate: true, flush: 'sync' }
)
watch(
  [productSearch, () => props.locale],
  (_, __, onCleanup) => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      productsBusy.value = true
      try {
        const result = await api.list(
          { search: productSearch.value, locale: props.locale, sortBy: 'title', sortDir: 'asc' },
          controller.signal
        )
        productOptions.value = result.items
          .filter((item) => item.slug)
          .map((item) => ({
            value: item.slug,
            label: `${item.content[props.locale].title || item.content.en.title || item.content.nl.title} (${item.slug})`
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
watch(
  () => props.locale,
  () => {
    productPreview.value = undefined
  }
)
async function loadPreview(edit = false) {
  const slug = (edit ? slugInput.value : previewSlug.value).trim()
  if (!slug) {
    error.value = t('products.thankYouSlugRequired')
    return
  }
  previewBusy.value = true
  productPreview.value = undefined
  error.value = ''
  try {
    const result = await api.previewOrderPage(slug, props.locale)
    if (edit) {
      activeSlug.value = slug
    }
    previewSlug.value = slug
    loadedPreviewSlug.value = slug
    productPreview.value = result
  } catch {
    error.value = t('products.thankYouProductMissing')
  } finally {
    previewBusy.value = false
  }
}
watch(
  () => copy.value.content,
  (content, _, onCleanup) => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const result = await api.renderStoreText(content, controller.signal)
        rendered.value = { content, html: result.html }
      } catch {
        if (!controller.signal.aborted) {
          error.value = t('products.storeTextPreviewFailed')
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
const previewOptions = computed(() => [
  { value: 'paid', label: t('products.paid') },
  { value: 'accepted', label: t('products.accepted') },
  { value: 'pending', label: t('products.pending') },
  { value: 'revoked', label: t('products.accessRevoked') },
  { value: 'failed', label: t('products.failed') },
  { value: 'expired', label: t('products.expired') },
  { value: 'missing', label: t('products.storeTextMissingPreview') },
  { value: 'error', label: t('products.storeTextErrorPreview') }
])
const examples = computed(() =>
  props.locale === 'nl'
    ? {
        product: 'Voorbeeld van een gekocht product',
        instructions: 'Hier verschijnen de gekochte instructies.',
        video: 'Voorbeeld van een videolink'
      }
    : {
        product: 'Example purchased product',
        instructions: 'Your purchased instructions appear here.',
        video: 'Example video link'
      }
)
const previewOrder = computed<PublicOrderDetails>(() => {
  const access = ['paid', 'accepted'].includes(previewState.value)
  const status = ['revoked', 'missing', 'error'].includes(previewState.value)
    ? 'paid'
    : (previewState.value as PublicOrderDetails['status'])
  if (productPreview.value) {
    return {
      ...productPreview.value,
      copy: copy.value,
      status,
      access,
      total: status === 'pending' ? null : productPreview.value.total,
      items: productPreview.value.items.map((item) => ({
        ...item,
        access,
        nextSteps: access ? item.nextSteps : '',
        files: access ? item.files : [],
        links: access ? item.links : [],
        filesPending: access && item.filesPending
      }))
    }
  }
  return {
    copy: copy.value,
    reference: 'BK-EXAMPLE',
    createdAt: '2026-01-15T12:00:00Z',
    locale: props.locale,
    status,
    access,
    total: status === 'pending' ? null : 1200,
    currency: 'EUR',
    appearance: appearance.value,
    items: [
      {
        id: 'example',
        title: examples.value.product,
        quantity: 1,
        amount: 1200,
        access,
        nextSteps: access ? examples.value.instructions : '',
        filesPending: access,
        files: access
          ? [
              {
                id: 'audio',
                name: 'Meditation.mp3',
                url: '#',
                previewUrl: '#',
                content_type: 'audio/mpeg',
                size: 2000000
              },
              { id: 'video', name: 'Lesson.mp4', url: '#', previewUrl: '#', content_type: 'video/mp4', size: 5000000 }
            ]
          : [],
        links: access
          ? [
              {
                id: 'example-link',
                name: examples.value.video,
                url: 'https://youtu.be/jNQXAC9IVRw'
              }
            ]
          : []
      }
    ]
  }
})
async function save() {
  busy.value = true
  error.value = ''
  try {
    const saved = await api.savePageText({
      ...target.value,
      copy: scope.value === 'product' ? { content: state.content } : { ...state }
    })
    entries.value = [
      ...entries.value.filter(
        (entry) => entry.locale !== props.locale || entry.productSlug !== target.value.productSlug
      ),
      saved
    ]
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
    await api.resetPageText({ ...target.value })
    entries.value = entries.value.filter(
      (entry) => entry.locale !== props.locale || entry.productSlug !== target.value.productSlug
    )
    drafts.delete(targetKey.value)
    Object.assign(
      state,
      scope.value === 'default'
        ? defaultOrderPageCopy(props.locale)
        : Object.fromEntries(Object.keys(defaultOrderPageCopy(props.locale)).map((key) => [key, '']))
    )
    toast.add({ title: t('products.storeTextResetDone'), color: 'success' })
  } catch {
    error.value = t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <template v-if="!loadFailed">
      <p class="text-sm text-muted">{{ t('products.storeTextOrderHelp') }}</p>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField :label="t('products.thankYouScope')"
          ><USelect v-model="scope" :items="scopeOptions" :disabled="busy || previewBusy" class="w-56"
        /></UFormField>
        <template v-if="scope === 'product'">
          <UFormField :label="t('products.thankYouChooseProduct')"
            ><USelectMenu
              v-model="slugInput"
              v-model:search-term="productSearch"
              :items="productOptions"
              value-key="value"
              :ignore-filter="true"
              :loading="productsBusy"
              :disabled="busy || previewBusy"
              class="w-80 max-w-full"
          /></UFormField>
          <UButton
            variant="outline"
            :disabled="busy || previewBusy"
            :loading="previewBusy"
            @click="loadPreview(true)"
            >{{ t('products.thankYouOpenProduct') }}</UButton
          >
        </template>
      </div>
      <UForm v-if="editable" :schema="schema" :state="state" novalidate class="space-y-4" @submit="save">
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="font-semibold">{{ t('products.storeTextPageWording') }}</h3>
              <UBadge variant="subtle" color="neutral">{{
                t(savedOverride ? 'products.storeTextCustomized' : 'products.storeTextDefault')
              }}</UBadge>
            </div>
          </template>
          <div class="divide-y divide-default">
            <details
              v-for="group in scope === 'product'
                ? [{ id: 'welcome', fields: ['content'] as const }]
                : orderPageTextGroups"
              :key="group.id"
              :open="group.id === 'welcome'"
              class="group py-3 first:pt-0 last:pb-0"
            >
              <summary class="flex cursor-pointer list-none items-center justify-between gap-3 py-1 font-semibold">
                {{ t(`products.storeTextGroups.${group.id}`)
                }}<UIcon name="i-lucide-chevron-down" class="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <UFormField
                  v-for="field in group.fields"
                  :key="field"
                  :name="field"
                  :label="t(`products.storeTextFields.${field}`)"
                  :class="field === 'content' || longFields.has(field) ? 'sm:col-span-2' : ''"
                >
                  <PortalMarkdownEditor
                    v-if="field === 'content'"
                    :key="targetKey"
                    v-model="state.content"
                    :placeholder="defaults.content"
                    :disabled="busy || previewBusy"
                    :rows="8"
                    class="w-full"
                  />
                  <UTextarea
                    v-else-if="longFields.has(field)"
                    v-model="state[field]"
                    :placeholder="defaults[field]"
                    :disabled="busy || previewBusy"
                    :rows="2"
                    autoresize
                    class="w-full"
                  />
                  <UInput
                    v-else
                    v-model="state[field]"
                    :placeholder="defaults[field]"
                    :disabled="busy || previewBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </details>
          </div>
          <template #footer>
            <div class="flex flex-wrap gap-3">
              <UButton type="submit" icon="i-lucide-save" :loading="busy" :disabled="previewBusy">{{
                t('products.save')
              }}</UButton>
              <UButton type="button" variant="outline" :disabled="busy || previewBusy" @click="reset">{{
                t('products.thankYouReset')
              }}</UButton>
            </div>
          </template>
        </UCard>
      </UForm>
      <section class="min-w-0 space-y-3" :aria-label="t('products.thankYouPreview')">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <h3 class="font-semibold">{{ t('products.thankYouPreview') }}</h3>
          <UFormField :label="t('products.storeTextPreviewState')"
            ><USelect v-model="previewState" :items="previewOptions" class="w-56"
          /></UFormField>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <UFormField :label="t('products.thankYouPreviewSlug')"
            ><USelectMenu
              v-model="previewSlug"
              v-model:search-term="productSearch"
              :items="productOptions"
              value-key="value"
              :ignore-filter="true"
              :loading="productsBusy"
              :disabled="busy || previewBusy"
              class="w-80 max-w-full"
          /></UFormField>
          <UButton variant="outline" :loading="previewBusy" :disabled="busy || previewBusy" @click="loadPreview()">{{
            t('products.thankYouPreview')
          }}</UButton>
          <UButton
            v-if="productPreview"
            variant="ghost"
            :disabled="busy || previewBusy"
            @click="productPreview = undefined"
            >{{ t('products.storeTextExamplePreview') }}</UButton
          >
        </div>
        <p class="text-sm text-muted">{{ t('products.storeTextPreviewHelp') }}</p>
        <ProductsPublicOrder
          :order="previewOrder"
          :copy="copy"
          :error="['missing', 'error'].includes(previewState)"
          :unavailable="previewState === 'missing'"
          preview
        />
      </section>
    </template>
  </div>
</template>
