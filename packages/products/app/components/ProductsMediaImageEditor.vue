<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import type { MediaEditorDocument } from '../utils/media-editor'
import { readMediaPreview } from '../utils/media-editor'
import { mediaDetailsSchema } from '../../shared/media'
import { defaultMediaVariantPresets, type MediaVariantPreset } from '../../shared/media-variants'
import {
  cropFrame,
  cropPixels,
  fullCrop,
  prepareImage,
  previewBlob,
  defaultAdjustments,
  imageGeometry,
  transformCrop,
  type CropRect,
  type ImageAdjustments
} from '../utils/media-image-processing'
import ProductsMediaCropper from './ProductsMediaCropper.vue'
import ProductsMediaCropActions from './ProductsMediaCropActions.vue'

export interface ImageSubmission {
  title: string
  alt: string
  categories: string[]
  credit: string
  visible: boolean
  blob: Blob
  filename: string
  imageChanged: boolean
  originalImage?: { blob: Blob; filename: string }
  thumbnail?: { blob: Blob; filename: string }
  variants?: { key: string; blob: Blob; filename: string }[]
  resetVariants?: string[]
}
const props = withDefaults(
  defineProps<{
    document?: MediaEditorDocument
    initialFile?: File
    initialDetails?: { categories: string[]; credit: string; visible: boolean }
    saveLabel?: string
    formats: string[]
    maximum: number
    categories: string[]
    busy: boolean
    presets?: MediaVariantPreset[]
    configurationError?: string
    saveImage: (value: ImageSubmission) => Promise<boolean>
  }>(),
  { presets: () => defaultMediaVariantPresets() }
)
const emit = defineEmits<{ back: []; dirty: [boolean]; working: [boolean] }>()
const { t } = useI18n(),
  mt = useMediaText(),
  message = useMediaError(),
  variantLabel = useMediaVariantLabel()
interface Core {
  blob?: Blob
  file?: File
  crop: CropRect
  selection: CropRect
  adjustments: ImageAdjustments
  dimensions: { width: number; height: number }
  mode: 'automatic' | 'custom'
  reset: boolean
  restored: boolean
}
interface History {
  core: Core
  variants?: Record<string, { core: Core; baseline?: Core }>
}
interface Target extends Core {
  preview: string
  baseline?: Core
  derivedFrom?: Blob
  undo: History[]
  redo: History[]
  animation: number
}
const empty = (): Target => ({
  crop: fullCrop(),
  selection: fullCrop(),
  adjustments: defaultAdjustments(),
  dimensions: { width: 0, height: 0 },
  mode: 'automatic',
  reset: false,
  restored: false,
  preview: '',
  undo: [],
  redo: [],
  animation: 0
})
const targets = reactive<Record<string, Target>>({ image: empty() })
for (const preset of props.presets) {
  const state = empty()
  state.mode = props.document?.data.variants?.[preset.key]?.mode || 'automatic'
  targets[preset.key] = state
}
const activeKey = ref('image'),
  current = computed(() => targets[activeKey.value]!),
  full = computed(() => targets.image!)
const activePreset = computed(() => props.presets.find((preset) => preset.key === activeKey.value))
const ratio = computed(() => (activePreset.value ? activePreset.value.width / activePreset.value.height : null))
const editing = ref(false),
  reading = ref(false),
  preparing = ref(false),
  error = ref('')
const locked = computed(() => props.busy || reading.value || preparing.value)
const isGif = computed(() => full.value.blob?.type === 'image/gif')
const canAdjust = computed(() => !locked.value && !!current.value.blob && !isGif.value)
const fields = reactive({
  title: props.document?.data.title || '',
  alt: props.document?.data.image.alt || '',
  categories: [...(props.document?.data.categories || props.initialDetails?.categories || [])],
  credit: props.document?.data.credit || props.initialDetails?.credit || '',
  visible: props.document?.data.visible ?? props.initialDetails?.visible ?? true
})
const detailsBaseline = JSON.stringify(fields),
  schema = useProductFormSchema(mediaDetailsSchema)
const editorForm = ref<{ validate: () => Promise<unknown> }>(),
  detailsTab = ref<HTMLButtonElement>(),
  adjustTab = ref<HTMLButtonElement>()
const adjustmentControlsId = `image-controls-${useId()}`
function capture(state: Core): Core {
  return {
    blob: state.blob,
    file: state.file,
    crop: { ...state.crop },
    selection: { ...state.selection },
    adjustments: { ...state.adjustments },
    dimensions: { ...state.dimensions },
    mode: state.mode,
    reset: state.reset,
    restored: state.restored
  }
}
function recipe(state: Core) {
  return JSON.stringify([
    Object.values(state.crop).map((value) => Math.round(value * 1e6)),
    state.adjustments,
    state.mode,
    state.reset,
    state.restored
  ])
}
function dirty(key: string) {
  const state = targets[key]!
  if (!state.blob) {
    return false
  }
  if (key !== 'image' && state.mode === 'automatic' && !state.reset && state.baseline?.mode !== 'custom') {
    return false
  }
  return (
    !state.baseline ||
    state.blob !== state.baseline.blob ||
    state.file !== state.baseline.file ||
    recipe(state) !== recipe(state.baseline)
  )
}
const hasEdits = computed(() => JSON.stringify(fields) !== detailsBaseline || Object.keys(targets).some(dirty))
const changed = computed(() => hasEdits.value || !!props.document?.data.variantsOutdated)
watch(hasEdits, (value) => emit('dirty', value), { immediate: true })
watch(locked, (value) => emit('working', value), { immediate: true })
const canCrop = computed(() => {
  if (!editing.value || locked.value || !current.value.blob || isGif.value) {
    return false
  }
  return JSON.stringify(current.value.selection) !== JSON.stringify(current.value.crop)
})
const upscaled = computed(() => {
  const state = current.value
  if (!activePreset.value || !state.dimensions.width) {
    return false
  }
  const geometry = imageGeometry(state.dimensions.width, state.dimensions.height, state.adjustments)
  const pixels = cropPixels(state.crop, geometry.width, geometry.height)
  return pixels.width < activePreset.value.width || pixels.height < activePreset.value.height
})
let sequence = 0,
  group: { key: string; control: string; recorded: boolean } | undefined
let fullCache: { source: Blob; recipe: string; blob: Blob } | undefined
function revoke(state: Target) {
  if (state.preview.startsWith('blob:')) {
    URL.revokeObjectURL(state.preview)
  }
}
async function dimensions(blob: Blob) {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}
function install(
  state: Target,
  blob: Blob,
  size: { width: number; height: number },
  aspect: number | null,
  baseline = false
) {
  revoke(state)
  state.blob = blob
  state.preview = URL.createObjectURL(blob)
  state.dimensions = size
  state.adjustments = defaultAdjustments()
  state.crop = aspect ? cropFrame(size.width, size.height, aspect, 100, 50, 50) : fullCrop()
  state.selection = { ...state.crop }
  if (baseline) {
    state.baseline = capture(state)
  }
  state.animation++
}
async function renderedFull() {
  const state = full.value,
    key = recipe(state)
  if (fullCache && fullCache.source === state.blob && fullCache.recipe === key) {
    return fullCache.blob
  }
  const blob = await prepareImage(state.blob!, state.crop, state.adjustments)
  fullCache = { source: state.blob!, recipe: key, blob }
  return blob
}
async function ensureTarget(key: string) {
  if (key === 'image') {
    return
  }
  const state = targets[key]!,
    preset = props.presets.find((value) => value.key === key)!
  if (state.mode === 'custom' && state.blob) {
    return
  }
  const saved = props.document?.data.variants?.[key]
  if (state.mode === 'custom' && saved && !full.value.file) {
    const blob = previewBlob(await readMediaPreview(saved.source?.url || saved.file.url))
    install(state, blob, await dimensions(blob), preset.width / preset.height, true)
  } else {
    const blob = await renderedFull()
    if (state.blob && state.derivedFrom === blob) {
      return
    }
    const baseline = !state.baseline
    install(state, blob, await dimensions(blob), preset.width / preset.height, baseline)
    state.derivedFrom = blob
  }
}
async function switchImage(key: string) {
  if (locked.value || !full.value.blob || activeKey.value === key) {
    return
  }
  current.value.selection = { ...current.value.crop }
  group = undefined
  reading.value = true
  error.value = ''
  try {
    await ensureTarget(key)
    activeKey.value = key
    current.value.animation++
  } catch (cause) {
    error.value = message(cause)
  } finally {
    reading.value = false
  }
}
function entry(key: string, includeVariants = false): History {
  return {
    core: capture(targets[key]!),
    ...(includeVariants
      ? {
          variants: Object.fromEntries(
            Object.entries(targets)
              .filter(([id]) => id !== 'image')
              .map(([id, state]) => [id, { core: capture(state), baseline: state.baseline && capture(state.baseline) }])
          )
        }
      : {})
  }
}
function record() {
  const state = current.value
  if (group?.key === activeKey.value && group.recorded) {
    return
  }
  state.undo.push(entry(activeKey.value))
  if (state.undo.length > 100) {
    state.undo.shift()
  }
  state.redo = []
  if (group) {
    group.recorded = true
  }
}
function restore(state: Target, core: Core) {
  revoke(state)
  Object.assign(state, capture(core))
  state.preview = core.blob ? URL.createObjectURL(core.blob) : ''
  state.selection = { ...state.crop }
  state.animation++
}
function history(redo = false) {
  if (locked.value) {
    return
  }
  group = undefined
  const state = current.value,
    source = redo ? state.redo : state.undo,
    destination = redo ? state.undo : state.redo
  const previous = source.pop()
  if (!previous) {
    return
  }
  destination.push(entry(activeKey.value, !!previous.variants))
  restore(state, previous.core)
  if (previous.variants) {
    for (const [key, saved] of Object.entries(previous.variants)) {
      if (targets[key]) {
        restore(targets[key]!, saved.core)
        targets[key]!.baseline = saved.baseline
      }
    }
  }
}
function startEdit(control: string) {
  if (group?.key !== activeKey.value || group.control !== control) {
    group = { key: activeKey.value, control, recorded: false }
  }
}
function endEdit() {
  group = undefined
}
function custom() {
  const state = current.value
  if (activeKey.value !== 'image') {
    state.mode = 'custom'
  }
}
function updateAdjustments(value: ImageAdjustments) {
  if (!editing.value || locked.value || JSON.stringify(current.value.adjustments) === JSON.stringify(value)) {
    return
  }
  record()
  const state = current.value,
    size = state.dimensions
  state.selection = transformCrop(state.selection, state.adjustments, value, size.width, size.height, ratio.value)
  state.crop = transformCrop(state.crop, state.adjustments, value, size.width, size.height, ratio.value)
  state.adjustments = { ...value }
  custom()
  if (activeKey.value !== 'image' && state.baseline?.mode === 'automatic' && state.blob === state.baseline.blob) {
    const candidate = { ...capture(state), mode: 'automatic' as const }
    if (recipe(candidate) === recipe(state.baseline)) {
      state.mode = 'automatic'
    }
  }
}
function selectCrop(value: CropRect) {
  current.value.selection = value
}
function cropImage() {
  if (!canCrop.value) {
    return
  }
  group = undefined
  record()
  current.value.crop = { ...current.value.selection }
  custom()
  current.value.animation++
}
function selectEditorTab(tab: 'details' | 'adjust') {
  if (locked.value || (tab === 'adjust' && !canAdjust.value)) {
    return
  }
  current.value.selection = { ...current.value.crop }
  group = undefined
  editing.value = tab === 'adjust'
  void nextTick(() => (editing.value ? adjustTab : detailsTab).value?.focus({ preventScroll: true }))
}
function navigateEditorTabs(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || locked.value) {
    return
  }
  event.preventDefault()
  selectEditorTab(
    event.key === 'Home' ? 'details' : event.key === 'End' ? 'adjust' : editing.value ? 'details' : 'adjust'
  )
}
async function resetCurrent() {
  if (locked.value || isGif.value || !current.value.blob) {
    return
  }
  group = undefined
  record()
  reading.value = true
  error.value = ''
  try {
    if (activeKey.value === 'image') {
      const state = full.value
      const blob =
        state.file ||
        (props.document?.data.image.originalSrc
          ? previewBlob(await readMediaPreview(props.document.data.image.originalSrc))
          : state.blob!)
      install(state, blob, await dimensions(blob), null)
      state.restored = !!props.document && !state.file
    } else {
      const state = current.value,
        blob = await renderedFull()
      install(state, blob, await dimensions(blob), ratio.value)
      state.mode = 'automatic'
      state.reset = props.document?.data.variants?.[activeKey.value]?.mode === 'custom'
      state.derivedFrom = blob
    }
  } catch (cause) {
    error.value = message(cause)
  } finally {
    reading.value = false
  }
}
async function chooseFile(value: File | null | undefined) {
  if (!value || locked.value) {
    return
  }
  const extension = value.name.split('.').pop()?.toLowerCase()
  if (!extension || !props.formats.includes(extension)) {
    error.value = t('products.media.chooseFormats', { formats: props.formats.join(', ').toUpperCase() })
    return
  }
  if (value.size > props.maximum) {
    error.value = t('products.media.chooseSize', { size: props.maximum / 1024 / 1024 })
    return
  }
  if (full.value.blob) {
    group = undefined
    full.value.undo.push(entry('image', true))
    full.value.redo = []
  }
  const request = ++sequence
  reading.value = true
  error.value = ''
  try {
    const blob = value.type
      ? value
      : new File([value], value.name, {
          type: extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`
        })
    const size = await dimensions(blob)
    if (request !== sequence) {
      return
    }
    install(full.value, blob, size, null)
    full.value.file = blob as File
    full.value.restored = false
    for (const preset of props.presets) {
      const state = targets[preset.key]!
      revoke(state)
      targets[preset.key] = empty()
    }
    activeKey.value = 'image'
    if (!props.document && !fields.title) {
      fields.title = value.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    }
  } catch (cause) {
    error.value = message(cause)
  } finally {
    if (request === sequence) {
      reading.value = false
    }
  }
}
async function readSavedImage() {
  reading.value = true
  error.value = ''
  const request = ++sequence
  try {
    const blob = previewBlob(await readMediaPreview(props.document!.data.image.src))
    const size = await dimensions(blob)
    if (request === sequence) {
      install(full.value, blob, size, null, true)
    }
  } catch (cause) {
    if (request === sequence) {
      error.value = message(cause)
    }
  } finally {
    if (request === sequence) {
      reading.value = false
    }
  }
}
function previewError(value: string) {
  error.value = value
}
async function savePending(): Promise<boolean> {
  if (locked.value) {
    return false
  }
  try {
    await editorForm.value?.validate()
  } catch {
    selectEditorTab('details')
    return false
  }
  if (!full.value.blob || !full.value.dimensions.width) {
    error.value = mt('Choose an image and wait for its preview.')
    return false
  }
  preparing.value = true
  error.value = ''
  group = undefined
  try {
    const blob = await renderedFull()
    if (blob.size > props.maximum) {
      throw new Error(mt('The cropped image exceeds the upload size limit. Choose a different image and try again.'))
    }
    const variants: NonNullable<ImageSubmission['variants']> = [],
      resets: string[] = []
    for (const preset of props.presets) {
      const state = targets[preset.key]!
      if (!dirty(preset.key)) {
        continue
      }
      if (state.mode === 'automatic') {
        if (state.reset) {
          resets.push(preset.key)
        }
        continue
      }
      const variant = await prepareImage(state.blob!, state.crop, state.adjustments)
      if (variant.size > props.maximum) {
        throw new Error(mt('The thumbnail exceeds the upload size limit. Choose a different image and try again.'))
      }
      variants.push({
        key: preset.key,
        blob: variant,
        filename: `${preset.key}.${variant.type === 'image/jpeg' ? 'jpg' : variant.type.split('/')[1] || 'png'}`
      })
    }
    return await props.saveImage({
      ...fields,
      title: fields.title.trim(),
      alt: fields.alt.trim(),
      categories: [...new Set(fields.categories.map((value) => value.trim()).filter(Boolean))],
      blob,
      filename: full.value.file?.name || props.document?.data.image.name || 'image.png',
      imageChanged: dirty('image'),
      originalImage: full.value.file ? { blob: full.value.blob!, filename: full.value.file.name } : undefined,
      variants,
      resetVariants: resets
    })
  } catch (cause) {
    error.value = message(cause)
    return false
  } finally {
    preparing.value = false
  }
}
onMounted(() => {
  if (props.initialFile) {
    void chooseFile(props.initialFile)
  } else if (props.document) {
    void readSavedImage()
  }
})
onBeforeUnmount(() => {
  ++sequence
  for (const state of Object.values(targets)) {
    revoke(state)
  }
  emit('working', false)
  emit('dirty', false)
})
defineExpose({ savePending })
</script>

<template>
  <section class="media-image-editor media-detail-editor" :class="{ 'media-image-editor--adjusting': editing }">
    <header class="editor-header media-detail-header">
      <div class="editor-heading">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="link"
          :disabled="locked"
          class="editor-back"
          @click="emit('back')"
          >{{ mt('Back to library') }}</UButton
        ><span class="editor-heading-divider" aria-hidden="true">/</span>
        <h1>{{ document?.data.title || t('products.media.upload') }}</h1>
      </div>
      <UButton
        class="page-save"
        :icon="changed ? 'i-lucide-save' : 'i-lucide-circle-check'"
        :aria-label="changed ? mt('Save changes') : mt('Save changes · All changes saved')"
        :loading="preparing"
        :disabled="locked || !changed || !full.blob"
        type="submit"
        form="media-image-form"
        >{{ saveLabel || mt('Save changes') }}</UButton
      >
    </header>
    <div class="media-detail-content">
      <UAlert v-if="error" color="error" :description="error" />
      <UAlert
        v-if="document?.data.variantsOutdated"
        color="info"
        :description="t('products.media.variants.pendingUpdate')"
      />
      <UForm
        id="media-image-form"
        ref="editorForm"
        :schema="schema"
        :state="fields"
        novalidate
        class="image-editor-form"
        @submit="savePending"
      >
        <div class="image-workspace details-section" :aria-busy="locked">
          <div class="image-editor-section-heading">
            <h2>{{ mt('Image appearance') }}</h2>
            <UFileUpload
              v-if="full.preview"
              v-slot="{ open }"
              :model-value="full.file"
              variant="button"
              :preview="false"
              :accept="formats.map((value) => '.' + value).join(',')"
              :disabled="locked"
              @update:model-value="chooseFile($event)"
              ><UButton
                type="button"
                icon="i-lucide-image-plus"
                color="neutral"
                variant="outline"
                :disabled="locked"
                @click="open()"
                >{{ mt('Replace image') }}</UButton
              ></UFileUpload
            >
          </div>
          <UFormField v-if="!full.preview && !document" :label="mt('Choose an image')" name="image"
            ><UFileUpload
              :model-value="full.file"
              :multiple="false"
              :accept="formats.map((value) => '.' + value).join(',')"
              :disabled="locked"
              :preview="false"
              icon="i-lucide-image-plus"
              :label="mt('Drop an image here')"
              :description="
                t('products.media.fileLimit', {
                  formats: formats.join(', ').toUpperCase(),
                  size: maximum / 1024 / 1024
                })
              "
              class="image-dropzone"
              @update:model-value="chooseFile($event)"
          /></UFormField>
          <p v-if="reading && !full.preview" role="status">{{ mt('Loading image…') }}</p>
          <UButton
            v-if="document && !full.preview && !reading"
            color="neutral"
            variant="outline"
            @click="readSavedImage"
            >{{ mt('Retry preview') }}</UButton
          >
          <div v-if="full.preview" class="image-preview-workspace">
            <div class="image-view-options" role="group" :aria-label="mt('Choose image to preview or adjust')">
              <button
                type="button"
                :aria-pressed="activeKey === 'image'"
                :disabled="locked"
                @click="switchImage('image')"
              >
                <UIcon name="i-lucide-image" /><span
                  >{{ mt('Full image') }}<small>{{ mt('Full view') }}</small></span
                >
              </button>
              <button
                v-for="preset in presets"
                :key="preset.key"
                type="button"
                :aria-pressed="activeKey === preset.key"
                :disabled="locked"
                @click="switchImage(preset.key)"
              >
                <UIcon name="i-lucide-gallery-thumbnails" /><span
                  >{{ variantLabel(preset)
                  }}<small
                    >{{ t(`products.media.variants.${targets[preset.key]?.mode || 'automatic'}`) }} ·
                    {{ preset.width }} × {{ preset.height }}</small
                  ></span
                >
              </button>
            </div>
            <p class="image-preview-description">
              {{
                activePreset
                  ? t('products.media.variants.output', { width: activePreset.width, height: activePreset.height })
                  : t('products.media.fullDescription')
              }}
            </p>
            <ProductsMediaCropper
              v-if="current.preview"
              :key="activeKey + current.preview"
              :active="true"
              :src="current.preview"
              :adjustments="current.adjustments"
              :selection="editing ? current.selection : current.crop"
              :applied-crop="current.crop"
              :editing="editing"
              :controls-target="`#${adjustmentControlsId}`"
              :can-crop="!isGif"
              :aspect-ratio="ratio"
              :aspect-ratio-label="activePreset ? `${activePreset.width}:${activePreset.height}` : undefined"
              :disabled="locked"
              :animation-version="current.animation"
              @edit-start="startEdit"
              @edit-end="endEdit"
              @update:adjustments="updateAdjustments"
              @update:crop="selectCrop"
              @error="previewError"
              ><template #crop-actions><ProductsMediaCropActions :can-crop="canCrop" @crop="cropImage" /></template
            ></ProductsMediaCropper>
            <p v-if="upscaled" class="text-sm text-warning">{{ t('products.media.variants.upscaled') }}</p>
            <div class="image-adjustment-actions image-adjustment-actions--idle">
              <UButton
                type="button"
                class="image-edit-toggle"
                :icon="editing ? 'i-lucide-file-text' : 'i-lucide-sliders-horizontal'"
                color="neutral"
                variant="outline"
                :disabled="locked || (!editing && !canAdjust)"
                @click="selectEditorTab(editing ? 'details' : 'adjust')"
                >{{ editing ? t('products.media.editDetails') : mt('Adjust image') }}</UButton
              ><UButton
                v-if="activePreset && !isGif"
                color="neutral"
                variant="ghost"
                icon="i-lucide-refresh-cw"
                :disabled="locked || (current.mode === 'automatic' && !dirty(activeKey))"
                @click="resetCurrent"
                >{{ t('products.media.variants.resetAutomatic') }}</UButton
              >
            </div>
          </div>
        </div>
        <div class="image-side-pane">
          <div class="image-editor-tabs" role="tablist" :aria-label="mt('Image editor')" @keydown="navigateEditorTabs">
            <button
              :id="`${adjustmentControlsId}-details-tab`"
              ref="detailsTab"
              type="button"
              role="tab"
              :aria-selected="!editing"
              :aria-controls="`${adjustmentControlsId}-details-panel`"
              :tabindex="editing ? -1 : 0"
              :disabled="locked"
              @click="selectEditorTab('details')"
            >
              {{ mt('Details') }}</button
            ><button
              :id="`${adjustmentControlsId}-adjust-tab`"
              ref="adjustTab"
              type="button"
              role="tab"
              :aria-selected="editing"
              :aria-controls="`${adjustmentControlsId}-adjust-panel`"
              :tabindex="editing ? 0 : -1"
              :disabled="!canAdjust"
              @click="selectEditorTab('adjust')"
            >
              {{ mt('Adjust image') }}
            </button>
          </div>
          <section
            v-show="editing"
            :id="`${adjustmentControlsId}-adjust-panel`"
            class="image-adjustments"
            role="tabpanel"
            :aria-labelledby="`${adjustmentControlsId}-adjust-tab`"
          >
            <div :id="adjustmentControlsId" class="image-adjustment-controls" />
          </section>
          <section
            v-show="!editing"
            :id="`${adjustmentControlsId}-details-panel`"
            class="image-metadata"
            role="tabpanel"
            :aria-labelledby="`${adjustmentControlsId}-details-tab`"
          >
            <UFormField :label="mt('Title')" name="title" required
              ><UInput v-model="fields.title" :disabled="locked" class="w-full"
            /></UFormField>
            <UFormField
              :label="mt('Description / alternative text')"
              name="alt"
              required
              :description="mt('Describe the image for visitors who cannot see it.')"
              ><UTextarea v-model="fields.alt" :rows="3" :disabled="locked" class="w-full"
            /></UFormField>
            <UFormField
              :label="mt('Categories')"
              name="categories"
              :error-pattern="/^categories/"
              :description="mt('Press Enter to add a category.')"
              ><UInputTags v-model="fields.categories" :disabled="locked" class="w-full" />
              <div class="category-suggestions">
                <UButton
                  v-for="category in categories.filter((value) => !fields.categories.includes(value))"
                  :key="category"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :disabled="locked"
                  @click="fields.categories.push(category)"
                  >{{ category }}</UButton
                >
              </div></UFormField
            >
            <UFormField :label="mt('Photo credit')" name="credit"
              ><UInput v-model="fields.credit" :disabled="locked" class="w-full"
            /></UFormField>
            <div class="image-visibility">
              <USwitch v-model="fields.visible" :label="mt('Visible on website')" :disabled="locked" />
              <p>{{ mt('Visible images appear after you publish your changes.') }}</p>
            </div>
          </section>
          <div class="image-adjustment-footer">
            <div class="image-adjustment-toolbar">
              <UButton
                v-if="activeKey === 'image' && !isGif && current.blob"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-rotate-ccw"
                :disabled="locked || !editing"
                :aria-label="mt('Reset to original')"
                @click="resetCurrent"
                >{{ mt('Reset to original') }}</UButton
              >
              <div class="image-history-actions" role="group" :aria-label="mt('Edit history')">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-undo-2"
                  :disabled="locked || !current.undo.length"
                  :aria-label="mt('Undo')"
                  @click="history(false)"
                  >{{ mt('Undo') }}</UButton
                ><UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-redo-2"
                  :disabled="locked || !current.redo.length"
                  :aria-label="mt('Redo')"
                  @click="history(true)"
                  >{{ mt('Redo') }}</UButton
                >
              </div>
            </div>
          </div>
        </div>
      </UForm>
      <div class="image-editor-footer media-detail-footer">
        <slot name="footer" /><UButton color="neutral" variant="outline" :disabled="locked" @click="emit('back')">{{
          mt('Cancel')
        }}</UButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.media-detail-content {
  gap: var(--space-xs);
}
.image-editor-form {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: var(--space-md);
  align-items: start;
  align-content: start;
}
.image-workspace {
  min-width: 0;
}
.image-workspace,
.image-metadata {
  padding: var(--space-md);
  margin: 0;
}
.image-metadata {
  display: grid;
  gap: var(--space-sm);
}
.image-metadata p {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.image-cropper {
  --crop-preview-height: clamp(10rem, 30vh, 20rem);
  --crop-preview-padding: var(--space-2xs);
}
.image-cropper :deep(.crop-caption) {
  margin-bottom: var(--space-xs);
}
.image-editor-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  margin-bottom: var(--space-sm);
}
.image-editor-section-heading h2,
.image-metadata h2 {
  margin: 0;
  font-size: var(--text-lg);
}
.image-dropzone {
  min-height: 22rem;
}
.image-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: 22rem;
}
.image-metadata,
.image-side-pane {
  container-type: inline-size;
  container-name: image-adjustments;
  min-width: 0;
}
.image-side-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: var(--rule-thin) solid var(--color-rule);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.image-editor-tabs {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-md);
  padding-inline: var(--space-sm);
  border-bottom: var(--rule-thin) solid var(--color-rule);
}
.image-editor-tabs button {
  min-height: var(--control-height);
  padding: var(--space-xs) 0;
  border-bottom: 2px solid transparent;
  color: var(--color-ink-muted);
  background: transparent;
  font-size: var(--text-sm);
}
.image-editor-tabs button[aria-selected='true'] {
  border-bottom-color: var(--color-accent);
  color: var(--color-ink);
  font-weight: 600;
}
.image-editor-tabs button:disabled {
  opacity: 0.5;
}
.image-editor-tabs button:focus-visible {
  outline-offset: -2px;
}
.image-adjustments {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.image-adjustment-controls {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: var(--space-sm);
  scrollbar-gutter: stable;
}
.image-adjustment-toolbar :deep(button) {
  min-height: 2.25rem;
  padding-inline: var(--space-2xs);
  font-size: var(--text-sm);
}
.image-editor-section-heading p,
.image-preview-description,
.image-adjustment-status {
  margin: var(--space-2xs) 0 0;
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
}
.image-preview-workspace {
  min-width: 0;
  color: var(--color-ink);
}
.image-preview-description {
  margin: 0 0 var(--space-sm);
}
.image-view-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2xs);
  margin-bottom: var(--space-sm);
}
.image-view-options button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  min-height: var(--control-height);
  padding: var(--space-2xs);
  text-align: left;
  border: var(--rule-thin) solid var(--color-rule);
  border-radius: var(--radius-input);
  color: var(--color-ink-muted);
  background: var(--color-surface);
  font-size: var(--text-sm);
  cursor: pointer;
}
.image-view-options button[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}
.image-view-options small {
  display: block;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  margin-top: var(--space-3xs);
}
.image-view-options button:focus-visible {
  outline: var(--rule-focus) solid var(--color-focus);
  outline-offset: var(--rule-focus-offset);
}
.image-view-options button:active {
  background: var(--color-accent-soft-hover);
}
.image-view-options button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (hover: hover) {
  .image-view-options button:not(:disabled):hover {
    background: var(--color-surface-hover);
  }
}
.image-adjustment-footer {
  flex-shrink: 0;
  border-top: var(--rule-thin) solid var(--color-rule);
  padding: var(--space-xs);
  display: grid;
  gap: var(--space-2xs);
}
.image-adjustment-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-xs);
}
.image-history-actions {
  display: flex;
  gap: var(--space-2xs);
  margin-left: auto;
}
@container image-adjustments (max-width: 22rem) {
  .image-history-actions .history-label {
    display: none;
  }
}
.image-adjustment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
  justify-content: flex-end;
}
.image-adjustment-actions--idle {
  justify-content: flex-start;
}
.image-adjustment-status {
  color: var(--color-accent);
  padding-top: var(--space-2xs);
}
@media (max-width: 414px) {
  .image-view-options button {
    gap: var(--space-2xs);
  }
  .image-view-options small {
    display: none;
  }
}
.category-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
  margin-top: var(--space-xs);
}
.category-suggestions :deep(button) {
  min-height: 2rem;
}
.image-visibility {
  border-top: var(--rule-thin) solid var(--color-rule);
  padding-top: var(--space-md);
}
.image-visibility p {
  margin-top: var(--space-2xs);
}
.image-editor-footer > div {
  display: flex;
  gap: var(--space-xs);
}
.media-image-editor :deep(button) {
  white-space: nowrap;
}
@media (max-width: 800px) {
  .image-editor-form {
    grid-template-columns: minmax(0, 1fr);
  }
  .image-workspace,
  .image-metadata {
    padding: var(--space-sm);
  }
  .image-dropzone {
    min-height: 16rem;
  }
}
/* Fit the preview and the control panel into the editor's available height.
   Only the controls scroll; their actions stay outside that scroll area. */
.media-image-editor--adjusting .image-editor-form {
  grid-template-columns: minmax(0, 1.5fr) minmax(17rem, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  align-content: stretch;
  overflow: hidden;
  scrollbar-gutter: auto;
  padding-bottom: var(--space-xs);
}
.media-image-editor--adjusting .image-workspace,
.media-image-editor--adjusting .image-preview-workspace {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.media-image-editor--adjusting .image-preview-workspace {
  flex: 1;
}
.media-image-editor--adjusting .image-side-pane {
  min-height: 0;
}
.media-image-editor--adjusting .image-editor-section-heading {
  flex-shrink: 0;
}
.media-image-editor--adjusting .image-preview-description {
  flex-shrink: 0;
}
.media-image-editor--adjusting :deep(.image-cropper--panel) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.media-image-editor--adjusting :deep(.crop-stage) {
  flex: 1;
  min-height: 0;
  height: 0;
}
.media-image-editor--adjusting :deep(.crop-caption) {
  flex-shrink: 0;
}
@media (max-width: 800px) {
  .media-image-editor--adjusting .image-editor-form {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(17rem, 45%) minmax(0, 1fr);
    gap: var(--space-xs);
  }
  .media-image-editor--adjusting .image-editor-footer,
  .media-image-editor--adjusting .image-editor-section-heading,
  .media-image-editor--adjusting .image-preview-description {
    display: none;
  }
  .media-image-editor--adjusting .image-workspace {
    padding: var(--space-2xs);
  }
  .media-image-editor--adjusting .image-view-options {
    margin-bottom: var(--space-2xs);
  }
  .media-image-editor--adjusting .image-view-options button {
    padding-block: var(--space-2xs);
  }
  .media-image-editor--adjusting :deep(.crop-stage) {
    --crop-preview-padding: var(--space-3xs);
  }
  .media-image-editor--adjusting :deep(.crop-caption) {
    font-size: var(--text-xs);
    margin-top: var(--space-3xs);
  }
}
@media (max-width: 800px) and (max-height: 650px) {
  .media-image-editor :deep(.crop-instructions) {
    display: none;
  }
}
/* Both desktop panes keep the same bounds when details become adjustments. */
@media (min-width: 801px) {
  .media-image-editor .image-editor-form {
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
    align-content: stretch;
    overflow: hidden;
    scrollbar-gutter: auto;
    padding-bottom: 0;
  }
  .image-workspace,
  .image-preview-workspace,
  .image-side-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .image-preview-workspace {
    flex: 1;
  }
  .image-metadata {
    flex: 1;
    min-height: 0;
    align-content: start;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scrollbar-gutter: stable;
  }
  .image-workspace {
    overflow-y: auto;
  }
  .image-editor-section-heading,
  .image-view-options,
  .image-preview-description,
  .image-adjustment-actions--idle,
  .image-adjustment-status {
    flex-shrink: 0;
  }
  .media-image-editor :deep(.image-cropper--panel) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .media-image-editor :deep(.crop-stage) {
    flex: 1;
    min-height: 0;
    height: 0;
  }
  .media-image-editor :deep(.crop-caption) {
    flex-shrink: 0;
  }
}

.image-view-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
@media (max-width: 600px) {
  .image-view-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
