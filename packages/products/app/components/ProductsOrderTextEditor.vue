<script setup lang="ts">
import {
  defaultOrderPageCopy,
  resolveOrderPageCopy,
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
const previewState = ref<'paid' | 'accepted' | 'pending' | 'revoked' | 'failed' | 'expired' | 'missing' | 'error'>(
  'paid'
)
const rendered = ref<{ content: string; html: string }>()
const defaults = computed(() => defaultOrderPageCopy(props.locale))
const copy = computed<OrderPageCopy>(() => {
  const resolved = resolveOrderPageCopy(state, props.locale)
  return { ...resolved, contentHtml: rendered.value?.content === resolved.content ? rendered.value.html : '' }
})
const savedOverride = computed(() =>
  entries.value.some((item) => item.locale === props.locale && Object.keys(item.copy).length)
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
watch(busy, (value) => emit('busy', value), { immediate: true })
try {
  const [texts, settings] = await Promise.all([api.pageTexts(), api.settings()])
  entries.value = texts
  appearance.value = settings.checkoutAppearance
} catch {
  error.value = t('products.loadFailed')
  loadFailed.value = true
}
watch(
  () => props.locale,
  (language, previous) => {
    if (previous) {
      drafts.set(previous, structuredClone(toRaw(state)))
    }
    Object.assign(
      state,
      drafts.get(language) ||
        resolveOrderPageCopy(entries.value.find((entry) => entry.locale === language)?.copy, language)
    )
  },
  { immediate: true, flush: 'sync' }
)
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
    const saved = await api.savePageText({ page: 'order-details', locale: props.locale, copy: { ...state } })
    entries.value = [...entries.value.filter((entry) => entry.locale !== props.locale), saved]
    drafts.delete(props.locale)
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
    await api.resetPageText({ page: 'order-details', locale: props.locale })
    entries.value = entries.value.filter((entry) => entry.locale !== props.locale)
    drafts.delete(props.locale)
    Object.assign(state, defaultOrderPageCopy(props.locale))
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
      <UForm :schema="schema" :state="state" novalidate class="space-y-4" @submit="save">
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
              v-for="group in orderPageTextGroups"
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
                    v-model="state.content"
                    :disabled="busy"
                    :rows="8"
                    class="w-full"
                  />
                  <UTextarea
                    v-else-if="longFields.has(field)"
                    v-model="state[field]"
                    :placeholder="defaults[field]"
                    :disabled="busy"
                    :rows="2"
                    autoresize
                    class="w-full"
                  />
                  <UInput
                    v-else
                    v-model="state[field]"
                    :placeholder="defaults[field]"
                    :disabled="busy"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </details>
          </div>
          <template #footer>
            <div class="flex flex-wrap gap-3">
              <UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('products.save') }}</UButton>
              <UButton type="button" variant="outline" :disabled="busy" @click="reset">{{
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
