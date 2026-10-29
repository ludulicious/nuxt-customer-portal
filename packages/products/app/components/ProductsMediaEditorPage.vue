<script setup lang="ts">
import type { StoreMedia } from '../../shared/media'
import { defaultMediaVariantPresets, type MediaVariantConfiguration } from '../../shared/media-variants'
import { mediaFormats, mediaMaximum } from '../../shared/media'
import type { ImageSubmission } from './ProductsMediaImageEditor.vue'
import { mediaEditorDocument } from '../utils/media-editor'

const props = defineProps<{ id?: string; batch?: boolean }>()
const mediaError = useMediaError()
const api = useStoreMedia(),
  route = useRoute(),
  router = useRouter(),
  { t } = useI18n()
const media = ref<StoreMedia>(),
  categories = ref<string[]>([]),
  loading = ref(true),
  error = ref(''),
  dirty = ref(false),
  working = ref(false),
  version = ref(0)
const configuration = ref<MediaVariantConfiguration>({ presets: defaultMediaVariantPresets(), revision: 1 })
const configured = ref(true)
const editor = ref<{ savePending: () => Promise<boolean> }>(),
  discardOpen = ref(false)
let pendingDestination: string | undefined,
  allowNavigation = false
const document = computed(() => (media.value ? mediaEditorDocument(media.value) : undefined))
const returnQuery = computed(() => Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'batch')))
const library = computed(() => ({ path: '/admin/products/media', query: returnQuery.value }))
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [list, settings, existing, presets] = await Promise.all([
      api.list({}),
      useProducts().settings(),
      props.id ? api.get(props.id) : undefined,
      api.presets()
    ])
    categories.value = list.categories
    configured.value = settings.storageConfigured
    media.value = existing
    configuration.value = presets
  } catch (cause) {
    error.value = mediaError(cause)
  } finally {
    loading.value = false
  }
}
onMounted(load)
async function save(value: ImageSubmission) {
  error.value = ''
  try {
    const saved = await api.save(value, props.batch ? undefined : media.value, configuration.value.revision)
    if (!props.batch) {
      media.value = saved
      version.value++
      dirty.value = false
    }
    categories.value = [...new Set([...categories.value, ...saved.categories])].sort()
    return true
  } catch (cause) {
    error.value = mediaError(cause)
    return false
  }
}
function back() {
  return router.push(library.value)
}
onBeforeRouteLeave((to) => {
  if (working.value) {
    return false
  }
  if (!dirty.value || allowNavigation) {
    return true
  }
  pendingDestination = to.fullPath
  discardOpen.value = true
  return false
})
function discard() {
  allowNavigation = true
  discardOpen.value = false
  return router.push(pendingDestination || library.value)
}
async function saveAndLeave() {
  if (await editor.value?.savePending()) {
    await discard()
  } else {
    discardOpen.value = false
  }
}
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (dirty.value || working.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="products-media p-4 sm:p-6 lg:p-8">
    <div v-if="loading" role="status">{{ t('products.media.loading') }}</div>
    <UAlert v-if="error" color="error" :description="error" class="mb-4"
      ><template #actions
        ><UButton v-if="!media && id" @click="load">{{ t('products.media.retry') }}</UButton></template
      ></UAlert
    >
    <UAlert
      v-if="!loading && !configured"
      color="warning"
      :description="t('products.media.configureStorage')"
      class="mb-4"
      ><template #actions
        ><UButton to="/admin/products/settings/storage">{{ t('products.settings') }}</UButton></template
      ></UAlert
    >
    <ProductsMediaBatchUpload
      v-if="!loading && configured && batch"
      ref="editor"
      :formats="mediaFormats"
      :maximum="mediaMaximum"
      :categories="categories"
      :busy="false"
      :presets="configuration.presets"
      :save-image="save"
      @back="back"
      @dirty="dirty = $event"
      @working="working = $event"
    />
    <ProductsMediaImageEditor
      v-else-if="!loading && configured && (!id || media)"
      :key="version"
      ref="editor"
      :document="document"
      :formats="mediaFormats"
      :maximum="mediaMaximum"
      :categories="categories"
      :busy="false"
      :presets="configuration.presets"
      :save-image="save"
      @back="back"
      @dirty="dirty = $event"
      @working="working = $event"
    />
  </div>
  <UModal v-if="discardOpen" v-model:open="discardOpen" :title="t('products.media.unsaved')">
    <template #body
      ><p>{{ t('products.media.unsavedHelp') }}</p></template
    >
    <template #footer>
      <UButton variant="outline" color="neutral" @click="discardOpen = false">{{
        t('products.media.keepEditing')
      }}</UButton>
      <UButton variant="outline" color="neutral" @click="discard">{{ t('products.media.discard') }}</UButton>
      <UButton :loading="working" @click="saveAndLeave">{{ t('products.media.save') }}</UButton>
    </template>
  </UModal>
</template>
