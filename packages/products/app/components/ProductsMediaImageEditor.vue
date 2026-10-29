<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { readMediaPreview } from '../utils/media-editor'
import { mediaDetailsSchema } from '../../shared/media'
import type { MediaEditorDocument as Document } from '../utils/media-editor'
import {
  cropFrame,
  cropPixels,
  fullCrop,
  prepareImage,
  previewBlob,
  defaultAdjustments,
  hasAdjustments,
  imageGeometry,
  transformCrop,
  type CropRect,
  type ImageAdjustments
} from '../utils/media-image-processing'
import ProductsMediaCropper from './ProductsMediaCropper.vue'
import ProductsMediaCropActions from './ProductsMediaCropActions.vue'

const mt = useMediaText()
const message = useMediaError()

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
}
const props = defineProps<{
  document?: Document
  initialFile?: File
  initialDetails?: { categories: string[]; credit: string; visible: boolean }
  saveLabel?: string
  formats: string[]
  maximum: number
  categories: string[]
  busy: boolean
  aspectRatio?: number | null
  aspectRatioLabel?: string
  thumbnailAspectRatio?: number | null
  thumbnailAspectRatioLabel?: string
  configurationError?: string
  saveImage: (value: ImageSubmission) => Promise<boolean>
}>()
const emit = defineEmits<{ back: []; dirty: [boolean]; working: [boolean] }>()
const file = ref<File | null>(),
  source = ref<Blob>(),
  preview = ref(''),
  filename = ref(''),
  preparing = ref(false),
  reading = ref(false),
  error = ref('')
const restoredOriginal = ref(false)
function previewError(target: 'image' | 'thumbnail', message: string) {
  error.value = message
  if (target === 'image') {
    dimensions.value = { width: 0, height: 0 }
  } else {
    thumbnailDimensions.value = { width: 0, height: 0 }
  }
}
const thumbnailSource = ref<Blob>()
const thumbnailPreview = ref('')
const thumbnailCrop = ref<CropRect>(fullCrop())
const thumbnailSelection = ref<CropRect>(fullCrop())
const imageAdjustments = ref(defaultAdjustments())
const thumbnailAdjustments = ref(defaultAdjustments())

const thumbnailDimensions = ref({ width: 0, height: 0 })
const initialThumbnailCrop = ref<CropRect>()
const thumbnailReset = ref(false)
const thumbnailRestoredOriginal = ref(false)
const thumbnailRequested = ref(false)
const separateThumbnail = computed(() => {
  const ratio = props.aspectRatio || (output.value && output.value.sourceWidth / output.value.sourceHeight)
  return (
    !!props.thumbnailAspectRatio &&
    (!!props.document?.data.thumbnail?.src ||
      thumbnailRequested.value ||
      (!!ratio && Math.abs(props.thumbnailAspectRatio - ratio) > 0.001))
  )
})
const thumbnailEdited = computed(
  () =>
    !!initialThumbnailCrop.value &&
    (Object.keys(thumbnailCrop.value) as (keyof CropRect)[]).some(
      (key) => Math.abs(thumbnailCrop.value[key] - initialThumbnailCrop.value![key]) > 0.000001
    )
)
const thumbnailChanged = computed(
  () =>
    separateThumbnail.value &&
    (!props.document?.data.thumbnail?.src ||
      !!file.value ||
      thumbnailEdited.value ||
      hasAdjustments(thumbnailAdjustments.value) ||
      thumbnailReset.value)
)
function updateThumbnailCrop(value: CropRect) {
  thumbnailSelection.value = { ...value }
  if (!initialThumbnailCrop.value && thumbnailDimensions.value.width) {
    thumbnailCrop.value = { ...value }
    initialThumbnailCrop.value = { ...value }
  }
}
function setThumbnailSource(blob: Blob, resetAdjustments = true) {
  if (thumbnailPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(thumbnailPreview.value)
  }
  thumbnailSource.value = blob
  thumbnailPreview.value = URL.createObjectURL(blob)
  thumbnailCrop.value = fullCrop()
  thumbnailSelection.value = fullCrop()
  initialThumbnailCrop.value = undefined
  thumbnailDimensions.value = { width: 0, height: 0 }
  if (resetAdjustments) {
    thumbnailAdjustments.value = defaultAdjustments()
  }
}
function resetThumbnail() {
  return resetCrop('thumbnail')
}
const initialCrop = ref<CropRect>()
const cropEdited = computed(
  () =>
    !!initialCrop.value &&
    (Object.keys(crop.value) as (keyof CropRect)[]).some(
      (key) => Math.abs(crop.value[key] - initialCrop.value![key]) > 0.000001
    )
)
function updateCrop(value: CropRect) {
  cropSelection.value = { ...value }
  if (!initialCrop.value && dimensions.value.width) {
    crop.value = { ...value }
    initialCrop.value = { ...value }
  }
}
function sameCrop(a: CropRect, b: CropRect) {
  return (Object.keys(a) as (keyof CropRect)[]).every((key) => Math.abs(a[key] - b[key]) < 0.000001)
}
const cropSelection = ref<CropRect>(fullCrop())
const crop = ref<CropRect>(fullCrop()),
  dimensions = ref({ width: 0, height: 0 })
const { t } = useI18n()
const schema = useProductFormSchema(mediaDetailsSchema)
const fields = ref({
  title: props.document?.data.title || '',
  alt: props.document?.data.image?.alt || '',
  categories: [...(props.document?.data.categories || props.initialDetails?.categories || [])] as string[],
  credit: props.document?.data.credit || props.initialDetails?.credit || '',
  visible: (props.document?.data.visible ?? props.initialDetails?.visible) !== false
})
const original = JSON.stringify(fields.value)
const errors = ref<Record<string, string>>({})
const locked = computed(() => props.busy || preparing.value || reading.value)
const isGif = computed(() => source.value?.type === 'image/gif')
const changed = computed(
  () =>
    pendingAdjustments.value ||
    !!file.value ||
    restoredOriginal.value ||
    JSON.stringify(fields.value) !== original ||
    cropEdited.value ||
    hasAdjustments(imageAdjustments.value) ||
    hasAdjustments(thumbnailAdjustments.value) ||
    thumbnailEdited.value ||
    thumbnailReset.value
)
const output = computed(() => {
  if (!dimensions.value.width) {
    return undefined
  }
  const size = imageGeometry(dimensions.value.width, dimensions.value.height, imageAdjustments.value)
  return cropPixels(crop.value, size.width, size.height)
})
// Snapshots contain image settings only; Undo never changes the details form.
const activeImage = ref<'image' | 'thumbnail'>('image')
const animationVersion = ref({ image: 0, thumbnail: 0 })
function switchImage(target: 'image' | 'thumbnail') {
  if (locked.value || activeImage.value === target) {
    return
  }
  activeImage.value = target
  endImageEdit()
  animationVersion.value[target]++
}
const originalImagePath = computed(() => {
  const image = props.document?.data.image
  return !file.value && image?.originalSrc !== image?.src ? image?.originalSrc : undefined
})
const thumbnailNeedsOriginal = computed(
  () =>
    !file.value &&
    !thumbnailRestoredOriginal.value &&
    (props.document?.data.thumbnail?.src
      ? props.document.data.thumbnail.src !== (originalImagePath.value || props.document.data.image.src)
      : !!originalImagePath.value)
)
const canResetCrop = computed(() => {
  if (isGif.value) {
    return false
  }
  const thumbnail = activeImage.value === 'thumbnail'
  const size = thumbnail ? thumbnailDimensions.value : dimensions.value
  if (!size.width) {
    return false
  }
  if (thumbnail ? thumbnailNeedsOriginal.value : originalImagePath.value && !restoredOriginal.value) {
    return true
  }
  const selection = thumbnail ? thumbnailSelection.value : cropSelection.value
  const applied = thumbnail ? thumbnailCrop.value : crop.value
  const geometry = imageGeometry(
    size.width,
    size.height,
    thumbnail ? thumbnailAdjustments.value : imageAdjustments.value
  )
  const reset = cropFrame(
    geometry.width,
    geometry.height,
    (thumbnail ? props.thumbnailAspectRatio : props.aspectRatio) || null,
    100,
    50,
    50
  )
  return (
    hasAdjustments(thumbnail ? thumbnailAdjustments.value : imageAdjustments.value) ||
    !sameCrop(selection, reset) ||
    !sameCrop(applied, reset)
  )
})
const canCropImage = computed(() => {
  if (!editing.value || locked.value || isGif.value) {
    return false
  }
  const thumbnail = activeImage.value === 'thumbnail'
  const size = thumbnail ? thumbnailDimensions.value : dimensions.value
  if (!size.width || !size.height) {
    return false
  }
  const geometry = imageGeometry(
    size.width,
    size.height,
    thumbnail ? thumbnailAdjustments.value : imageAdjustments.value
  )
  const selection = cropPixels(
    thumbnail ? thumbnailSelection.value : cropSelection.value,
    geometry.width,
    geometry.height
  )
  const applied = cropPixels(thumbnail ? thumbnailCrop.value : crop.value, geometry.width, geometry.height)
  const removesPixels = selection.width < geometry.width || selection.height < geometry.height
  const different =
    selection.x !== applied.x ||
    selection.y !== applied.y ||
    selection.width !== applied.width ||
    selection.height !== applied.height
  const newThumbnail = thumbnail && !props.document?.data.thumbnail?.src && !thumbnailRequested.value
  return removesPixels && (different || newThumbnail)
})
const adjustmentStatus = ref('')
const imageWorkspace = ref<HTMLElement>()
const editorForm = ref<{ $el: HTMLFormElement; validate: () => Promise<unknown> }>()
const detailsTab = ref<HTMLButtonElement>()
const adjustTab = ref<HTMLButtonElement>()
const adjustmentControlsId = `image-controls-${useId()}`
const adjustmentStart = ref<ReturnType<typeof snapshot>>()
const editHistory = ref<{ state: ReturnType<typeof snapshot>; target: 'image' | 'thumbnail' }[]>([])
const redoHistory = ref<(typeof editHistory.value)[number][]>([])
let editGroup: { target: 'image' | 'thumbnail'; control: string; recorded: boolean } | undefined
const editing = computed(() => !!adjustmentStart.value)
const canAdjust = computed(() => !locked.value && !!dimensions.value.width && !isGif.value)
watch(editing, async (value) => {
  await nextTick()
  if (value && editorForm.value) {
    editorForm.value.$el.scrollTop = 0
  }
  ;(value ? adjustTab : detailsTab).value?.focus({ preventScroll: true })
})
function selectEditorTab(target: 'details' | 'adjust') {
  if (locked.value || (target === 'adjust' && !canAdjust.value)) {
    return
  }
  if (target === 'adjust') {
    beginAdjustments()
  } else {
    finishAdjustments()
  }
  void nextTick(() =>
    (target === 'adjust' ? adjustTab : detailsTab).value?.focus({
      preventScroll: true
    })
  )
}
function navigateEditorTabs(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return
  }
  event.preventDefault()
  const target =
    event.key === 'Home' ? 'details' : event.key === 'End' ? 'adjust' : editing.value ? 'details' : 'adjust'
  if (target === 'adjust' && !canAdjust.value) {
    selectEditorTab('details')
  } else {
    selectEditorTab(target)
  }
}
function beginImageEdit(target: 'image' | 'thumbnail', control: string) {
  if (editGroup?.target !== target || editGroup.control !== control) {
    editGroup = { target, control, recorded: false }
  }
}
function endImageEdit(control?: string) {
  if (!control || editGroup?.control === control) {
    editGroup = undefined
  }
}
function recordImageEdit(target: 'image' | 'thumbnail') {
  if (!editing.value || editGroup?.recorded) {
    return
  }
  redoHistory.value = []
  editHistory.value.push({ state: snapshot(), target })
  if (editHistory.value.length > 100) {
    editHistory.value.shift()
  }
  if (editGroup) {
    editGroup.recorded = true
  }
}
function updateAdjustments(target: 'image' | 'thumbnail', value: ImageAdjustments) {
  if (locked.value || !editing.value) {
    return
  }
  const settings = target === 'image' ? imageAdjustments : thumbnailAdjustments
  if (JSON.stringify(settings.value) === JSON.stringify(value)) {
    return
  }
  const applied = target === 'image' ? crop : thumbnailCrop
  const selection = target === 'image' ? cropSelection : thumbnailSelection
  const size = target === 'image' ? dimensions.value : thumbnailDimensions.value
  const ratio = target === 'image' ? props.aspectRatio : props.thumbnailAspectRatio
  recordImageEdit(target)
  applied.value = transformCrop(applied.value, settings.value, value, size.width, size.height, ratio)
  selection.value = transformCrop(selection.value, settings.value, value, size.width, size.height, ratio)
  settings.value = { ...value }
  if (target === 'thumbnail' && !props.document?.data.thumbnail?.src) {
    thumbnailRequested.value = true
    thumbnailReset.value = true
  }
}

function snapshot() {
  return {
    file: file.value,
    source: source.value,
    filename: filename.value,
    restoredOriginal: restoredOriginal.value,
    crop: { ...crop.value },
    imageAdjustments: { ...imageAdjustments.value },
    thumbnailAdjustments: { ...thumbnailAdjustments.value },
    initialCrop: initialCrop.value && { ...initialCrop.value },
    dimensions: { ...dimensions.value },
    thumbnailSource: thumbnailSource.value,
    thumbnailCrop: { ...thumbnailCrop.value },
    initialThumbnailCrop: initialThumbnailCrop.value && {
      ...initialThumbnailCrop.value
    },
    thumbnailDimensions: { ...thumbnailDimensions.value },
    thumbnailReset: thumbnailReset.value,
    thumbnailRestoredOriginal: thumbnailRestoredOriginal.value,
    thumbnailRequested: thumbnailRequested.value
  }
}
function settingsKey(value: ReturnType<typeof snapshot>) {
  return JSON.stringify([
    value.filename,
    value.restoredOriginal,
    ...[value.crop.x, value.crop.y, value.crop.width, value.crop.height].map((n) => Math.round(n * 1e6)),
    ...[value.thumbnailCrop.x, value.thumbnailCrop.y, value.thumbnailCrop.width, value.thumbnailCrop.height].map((n) =>
      Math.round(n * 1e6)
    ),
    value.thumbnailReset,
    value.thumbnailRequested,
    value.imageAdjustments,
    value.thumbnailAdjustments
  ])
}
const pendingAdjustments = computed(() => {
  const before = adjustmentStart.value
  return (
    !!before &&
    (before.source !== source.value ||
      before.thumbnailSource !== thumbnailSource.value ||
      settingsKey(before) !== settingsKey(snapshot()))
  )
})
function startAdjustmentSession() {
  if (locked.value) {
    return
  }
  if (!adjustmentStart.value) {
    adjustmentStart.value = snapshot()
  }
  endImageEdit()
  adjustmentStatus.value = ''
}
function beginAdjustments() {
  if (!canAdjust.value || editing.value) {
    return
  }
  startAdjustmentSession()
}
function restoreSnapshot(value: ReturnType<typeof snapshot>) {
  ++sequence
  // Crop selection is a view control, not part of the edit history.
  cropSelection.value =
    source.value === value.source && value.dimensions.width
      ? transformCrop(
          cropSelection.value,
          imageAdjustments.value,
          value.imageAdjustments,
          value.dimensions.width,
          value.dimensions.height,
          props.aspectRatio
        )
      : { ...value.crop }
  thumbnailSelection.value =
    thumbnailSource.value === value.thumbnailSource && value.thumbnailDimensions.width
      ? transformCrop(
          thumbnailSelection.value,
          thumbnailAdjustments.value,
          value.thumbnailAdjustments,
          value.thumbnailDimensions.width,
          value.thumbnailDimensions.height,
          props.thumbnailAspectRatio
        )
      : { ...value.thumbnailCrop }
  if (source.value !== value.source) {
    if (preview.value.startsWith('blob:')) {
      URL.revokeObjectURL(preview.value)
    }
    preview.value = value.source ? URL.createObjectURL(value.source) : ''
  }
  if (thumbnailSource.value !== value.thumbnailSource) {
    if (thumbnailPreview.value.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailPreview.value)
    }
    thumbnailPreview.value = value.thumbnailSource ? URL.createObjectURL(value.thumbnailSource) : ''
  }
  file.value = value.file
  source.value = value.source
  filename.value = value.filename
  restoredOriginal.value = value.restoredOriginal
  crop.value = { ...value.crop }
  imageAdjustments.value = { ...value.imageAdjustments }
  thumbnailAdjustments.value = { ...value.thumbnailAdjustments }
  initialCrop.value = value.initialCrop && { ...value.initialCrop }
  dimensions.value = { ...value.dimensions }
  thumbnailSource.value = value.thumbnailSource
  thumbnailCrop.value = { ...value.thumbnailCrop }
  initialThumbnailCrop.value = value.initialThumbnailCrop && {
    ...value.initialThumbnailCrop
  }
  thumbnailDimensions.value = { ...value.thumbnailDimensions }
  thumbnailReset.value = value.thumbnailReset
  thumbnailRestoredOriginal.value = value.thumbnailRestoredOriginal
  thumbnailRequested.value = value.thumbnailRequested
  if (!separateThumbnail.value) {
    activeImage.value = 'image'
  }
  error.value = ''
  errors.value = {}
}
function focusPreviewButton() {
  void nextTick(() => imageWorkspace.value?.querySelector<HTMLButtonElement>('.image-edit-toggle')?.focus())
}
function cropImage() {
  if (!canCropImage.value) {
    return
  }
  const target = activeImage.value
  endImageEdit()
  recordImageEdit(target)
  if (target === 'thumbnail') {
    thumbnailCrop.value = { ...thumbnailSelection.value }
    thumbnailRequested.value = true
    thumbnailReset.value = true
  } else {
    crop.value = { ...cropSelection.value }
  }
  adjustmentStatus.value = mt('Image cropped. Save changes when you’re ready.')
  animationVersion.value[target]++
  error.value = ''
}
function finishAdjustments() {
  if (locked.value || !editing.value) {
    return
  }
  if (pendingAdjustments.value) {
    adjustmentStatus.value = mt('Adjustments kept. Save changes when you’re ready.')
  }
  cropSelection.value = { ...crop.value }
  thumbnailSelection.value = { ...thumbnailCrop.value }
  adjustmentStart.value = undefined
  endImageEdit()
  animationVersion.value[activeImage.value]++
}
function undoAdjustments() {
  if (locked.value) {
    return
  }
  endImageEdit()
  const previous = editHistory.value.pop()
  if (!previous) {
    return
  }
  redoHistory.value.push({ state: snapshot(), target: previous.target })
  restoreSnapshot(previous.state)
  activeImage.value = previous.target === 'thumbnail' && separateThumbnail.value ? 'thumbnail' : 'image'
  animationVersion.value[activeImage.value]++
  adjustmentStatus.value = mt('Image adjustments undone.')
  if (!editing.value) {
    focusPreviewButton()
  }
}
function redoAdjustments() {
  if (locked.value) {
    return
  }
  endImageEdit()
  const next = redoHistory.value.pop()
  if (!next) {
    return
  }
  editHistory.value.push({ state: snapshot(), target: next.target })
  restoreSnapshot(next.state)
  activeImage.value = next.target === 'thumbnail' && separateThumbnail.value ? 'thumbnail' : 'image'
  animationVersion.value[activeImage.value]++
  adjustmentStatus.value = mt('Image adjustments restored.')
  if (!editing.value) {
    focusPreviewButton()
  }
}
watch(changed, (value) => emit('dirty', value), { immediate: true })
let sequence = 0
function release() {
  if (preview.value.startsWith('blob:')) {
    URL.revokeObjectURL(preview.value)
  }
  preview.value = ''
  if (thumbnailPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(thumbnailPreview.value)
  }
  thumbnailPreview.value = ''
  thumbnailSource.value = undefined
}
function setImageSource(blob: Blob, name: string, resetAdjustments = true) {
  if (preview.value.startsWith('blob:')) {
    URL.revokeObjectURL(preview.value)
  }
  source.value = blob
  filename.value = name
  preview.value = URL.createObjectURL(blob)
  crop.value = fullCrop()
  cropSelection.value = fullCrop()
  initialCrop.value = undefined
  dimensions.value = { width: 0, height: 0 }
  if (resetAdjustments) {
    imageAdjustments.value = defaultAdjustments()
  }
}
function setSource(blob: Blob, name: string) {
  setImageSource(blob, name)
  setThumbnailSource(blob)
  thumbnailReset.value = false
  thumbnailRestoredOriginal.value = false
  thumbnailRequested.value = false
}
async function readSavedImage() {
  const id = ++sequence
  reading.value = true
  error.value = ''
  emit('working', true)
  try {
    const src = props.document!.data.image.src
    const url = await readMediaPreview(src)
    const blob = previewBlob(url)
    if (id === sequence) {
      setSource(blob, src.split('/').pop() || 'image.jpg')
      restoredOriginal.value = false
    }
    const thumbnail = props.document?.data.thumbnail?.src
    if (thumbnail && props.thumbnailAspectRatio) {
      const url = await readMediaPreview(thumbnail)
      if (id === sequence) {
        setThumbnailSource(previewBlob(url))
      }
    }
  } catch (e) {
    if (id === sequence) {
      error.value = message(e)
    }
  } finally {
    if (id === sequence) {
      reading.value = false
      emit('working', false)
    }
  }
}
async function resetCrop(target: 'image' | 'thumbnail') {
  if (locked.value || isGif.value || !source.value) {
    return
  }
  startAdjustmentSession()
  const id = ++sequence
  const originalPath =
    !restoredOriginal.value && (target === 'image' ? !!originalImagePath.value : thumbnailNeedsOriginal.value)
      ? originalImagePath.value
      : undefined
  error.value = ''
  if (originalPath) {
    reading.value = true
    emit('working', true)
  }
  try {
    const originalSource = originalPath ? previewBlob(await readMediaPreview(originalPath)) : source.value
    if (id !== sequence) {
      return
    }
    endImageEdit()
    const size = target === 'image' ? dimensions.value : thumbnailDimensions.value
    const geometry = imageGeometry(
      size.width || 1,
      size.height || 1,
      target === 'image' ? imageAdjustments.value : thumbnailAdjustments.value
    )
    const reset = cropFrame(
      geometry.width,
      geometry.height,
      (target === 'image' ? props.aspectRatio : props.thumbnailAspectRatio) || null,
      100,
      50,
      50
    )
    const changesImage =
      !!originalPath ||
      (target === 'thumbnail' &&
        (thumbnailNeedsOriginal.value || (!props.document?.data.thumbnail?.src && !thumbnailRequested.value))) ||
      !sameCrop(target === 'image' ? crop.value : thumbnailCrop.value, reset)
    if (changesImage) {
      recordImageEdit(target)
    }
    if (target === 'thumbnail') {
      activeImage.value = 'thumbnail'
      if (changesImage) {
        thumbnailRequested.value = true
      }
      if (thumbnailNeedsOriginal.value) {
        setThumbnailSource(originalSource)
        thumbnailRestoredOriginal.value = true
      } else {
        thumbnailAdjustments.value = defaultAdjustments()
        const size = imageGeometry(
          thumbnailDimensions.value.width || 1,
          thumbnailDimensions.value.height || 1,
          thumbnailAdjustments.value
        )
        thumbnailCrop.value = cropFrame(size.width, size.height, props.thumbnailAspectRatio || null, 100, 50, 50)
      }
      thumbnailSelection.value = { ...thumbnailCrop.value }
      if (changesImage) {
        thumbnailReset.value = true
      }
    } else if (originalPath) {
      // Restore only the full image. The thumbnail keeps its own source and crop.
      setImageSource(originalSource, filename.value)
      restoredOriginal.value = true
    } else {
      imageAdjustments.value = defaultAdjustments()
      const size = imageGeometry(dimensions.value.width, dimensions.value.height, imageAdjustments.value)
      crop.value = cropFrame(size.width, size.height, props.aspectRatio || null, 100, 50, 50)
    }
    if (target === 'image') {
      cropSelection.value = { ...crop.value }
    }
    errors.value.image = ''
    animationVersion.value[target]++
    await nextTick()
    imageWorkspace.value
      ?.querySelector<HTMLElement>('.image-cropper:not([style*="display: none"]) .crop-stage')
      ?.focus({ preventScroll: true })
  } catch (e) {
    if (id === sequence) {
      error.value = message(e)
    }
  } finally {
    if (id === sequence && originalPath) {
      reading.value = false
      emit('working', false)
    }
  }
}
if (props.document) {
  void readSavedImage()
}
function chooseFile(value: File | null | undefined, initial = false) {
  if (!value || locked.value) {
    return
  }
  error.value = ''
  const extension = value.name.split('.').pop()?.toLowerCase()
  if (!extension || !props.formats.includes(extension)) {
    error.value = t('products.media.chooseFormats', { formats: props.formats.join(', ').toUpperCase() })
    return
  }
  if (value.size > props.maximum) {
    error.value = t('products.media.chooseSize', { size: props.maximum / 1024 / 1024 })
    return
  }
  if (source.value && !initial) {
    startAdjustmentSession()
    recordImageEdit('image')
  }
  ++sequence
  file.value = value
  animationVersion.value = { image: 0, thumbnail: 0 }
  restoredOriginal.value = false
  errors.value = {}
  const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`
  setSource(value.type ? value : new Blob([value], { type: mime }), value.name)
  activeImage.value = 'image'
  if (!props.document && !fields.value.title) {
    fields.value.title = value.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  }
}
if (props.initialFile) {
  chooseFile(props.initialFile, true)
}
onBeforeUnmount(() => {
  ++sequence
  release()
  emit('dirty', false)
})
function imageIssues() {
  const issues: Record<string, string> = {}
  if (props.configurationError) {
    issues.image = props.configurationError
  }
  if (
    isGif.value &&
    props.aspectRatio &&
    Math.abs(dimensions.value.width / dimensions.value.height - props.aspectRatio) > 0.001
  ) {
    issues.image = `Choose a JPG, PNG or WebP image to crop to the website’s ${props.aspectRatioLabel} ratio.`
  }
  if (!source.value || !dimensions.value.width) {
    issues.image = mt('Choose an image and wait for its preview.')
  }
  if (separateThumbnail.value && (!thumbnailSource.value || !thumbnailDimensions.value.width)) {
    issues.image = mt('Wait for the thumbnail preview before saving.')
  }
  if (separateThumbnail.value && isGif.value) {
    issues.image = mt('Choose a JPG, PNG or WebP image to create a separate thumbnail crop.')
  }
  return issues
}
function validate() {
  const issues = imageIssues()
  if (!fields.value.title.trim()) {
    issues.title = mt('Give this image a title.')
  }
  if (!fields.value.alt.trim()) {
    issues.alt = mt('Describe what is in the image.')
  }
  errors.value = issues
  return !Object.keys(issues).length
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
  if (!validate()) {
    if (errors.value.title || errors.value.alt) {
      selectEditorTab('details')
    }
    return false
  }
  endImageEdit()
  preparing.value = true
  emit('working', true)
  error.value = ''
  try {
    const blob = await prepareImage(
      source.value!,
      props.document &&
        !file.value &&
        !restoredOriginal.value &&
        !hasAdjustments(imageAdjustments.value) &&
        !cropEdited.value
        ? fullCrop()
        : crop.value,
      imageAdjustments.value
    )
    if (blob.size > props.maximum) {
      throw new Error(mt('The cropped image exceeds the upload size limit. Choose a different image and try again.'))
    }
    let thumbnail: ImageSubmission['thumbnail']
    if (thumbnailChanged.value) {
      const thumbnailBlob = await prepareImage(
        thumbnailSource.value!,
        props.document?.data.thumbnail?.src &&
          !file.value &&
          !thumbnailEdited.value &&
          !thumbnailReset.value &&
          !hasAdjustments(thumbnailAdjustments.value)
          ? fullCrop()
          : thumbnailCrop.value,
        thumbnailAdjustments.value
      )
      if (thumbnailBlob.size > props.maximum) {
        throw new Error(mt('The thumbnail exceeds the upload size limit. Choose a different image and try again.'))
      }
      thumbnail = {
        blob: thumbnailBlob,
        filename: filename.value.replace(/(\.[^.]+)$/, '-thumbnail$1')
      }
    }
    return await props.saveImage({
      ...fields.value,
      title: fields.value.title.trim(),
      alt: fields.value.alt.trim(),
      categories: [...new Set(fields.value.categories.map((c) => c.trim()).filter(Boolean))],
      blob,
      thumbnail,
      filename: filename.value,
      originalImage: file.value ? { blob: source.value!, filename: filename.value } : undefined,
      imageChanged:
        !props.document ||
        !!file.value ||
        restoredOriginal.value ||
        hasAdjustments(imageAdjustments.value) ||
        cropEdited.value
    })
  } catch (e) {
    error.value = message(e)
    return false
  } finally {
    preparing.value = false
    emit('working', false)
  }
}
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
        >
        <span class="editor-heading-divider" aria-hidden="true">/</span>
        <h1>
          {{ document?.data.title || (document ? t('products.media.edit') : t('products.media.upload')) }}
        </h1>
      </div>
      <div class="editor-tools">
        <div class="action-row page-buttons">
          <UButton
            class="page-save"
            :class="{ 'page-save--saved': !changed }"
            :icon="changed ? 'i-lucide-save' : 'i-lucide-circle-check'"
            :title="changed ? mt('Save your changes') : mt('All changes saved')"
            :aria-label="changed ? mt('Save changes') : mt('Save changes · All changes saved')"
            :loading="preparing || busy"
            :disabled="!changed || locked || !source || !dimensions.width"
            type="submit"
            form="media-image-form"
            >{{ saveLabel || mt('Save changes') }}</UButton
          >
        </div>
      </div>
    </header>
    <div class="media-detail-content">
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :description="error"
        class="mb-6"
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
        <div ref="imageWorkspace" class="image-workspace details-section" :aria-busy="locked">
          <div class="image-editor-section-heading">
            <div>
              <h2>{{ mt('Image appearance') }}</h2>
            </div>
            <UFileUpload
              v-if="preview"
              v-slot="{ open }"
              :model-value="file"
              variant="button"
              :preview="false"
              :accept="formats.map((f) => '.' + f).join(',')"
              :disabled="locked"
              @update:model-value="chooseFile($event)"
            >
              <UButton
                type="button"
                icon="i-lucide-image-plus"
                color="neutral"
                variant="outline"
                :disabled="locked"
                @click="open()"
                >{{ mt('Replace image') }}</UButton
              >
            </UFileUpload>
          </div>
          <UFormField v-if="!preview && !document" :label="mt('Choose an image')" name="image" :error="errors.image">
            <UFileUpload
              :model-value="file"
              :multiple="false"
              :accept="formats.map((f) => '.' + f).join(',')"
              :disabled="locked"
              :preview="false"
              icon="i-lucide-image-plus"
              :label="mt('Drop an image here')"
              :description="`${formats.join(', ').toUpperCase()} · up to ${maximum / 1024 / 1024} MB`"
              class="image-dropzone"
              :ui="{ base: 'min-h-80' }"
              @update:model-value="chooseFile($event)"
            />
          </UFormField>
          <div v-if="reading && !preview" class="image-loading" role="status">
            <UIcon name="i-lucide-loader-circle" class="spinner" />{{ mt('Loading image\u2026') }}
          </div>
          <UButton
            v-if="document && !preview && !reading"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            @click="readSavedImage()"
            >{{ mt('Retry preview') }}</UButton
          >
          <div v-if="preview" class="image-preview-workspace">
            <div
              v-if="separateThumbnail"
              class="image-view-options"
              role="group"
              :aria-label="mt('Choose image to preview or adjust')"
            >
              <button
                type="button"
                :aria-pressed="activeImage === 'image'"
                :disabled="locked"
                @click="switchImage('image')"
              >
                <UIcon name="i-lucide-image" /><span
                  >{{ mt('Full image') }}<small>{{ mt('Full view') }}</small></span
                >
              </button>
              <button
                type="button"
                :aria-pressed="activeImage === 'thumbnail'"
                :disabled="locked"
                @click="switchImage('thumbnail')"
              >
                <UIcon name="i-lucide-gallery-thumbnails" /><span
                  >{{ mt('Thumbnail') }}<small>{{ mt('Lists &amp; galleries') }}</small></span
                >
              </button>
            </div>
            <p class="image-preview-description">
              {{
                activeImage === 'thumbnail'
                  ? t('products.media.thumbnailDescription')
                  : t('products.media.fullDescription')
              }}
            </p>
            <ProductsMediaCropper
              v-show="activeImage === 'image'"
              :key="preview"
              :src="preview"
              :animation-version="animationVersion.image"
              :active="activeImage === 'image'"
              :adjustments="imageAdjustments"
              :selection="initialCrop ? (editing ? cropSelection : crop) : undefined"
              :applied-crop="crop"
              :editing="editing"
              :controls-target="`#${adjustmentControlsId}`"
              :can-crop="!isGif"
              :aspect-ratio="aspectRatio"
              :aspect-ratio-label="aspectRatioLabel"
              :disabled="locked"
              @edit-start="beginImageEdit('image', $event)"
              @edit-end="endImageEdit"
              @update:adjustments="updateAdjustments('image', $event)"
              @update:crop="updateCrop"
              @dimensions="dimensions = $event"
              @error="previewError('image', $event)"
            >
              <template #crop-actions>
                <ProductsMediaCropActions :can-crop="canCropImage" @crop="cropImage" />
              </template>
            </ProductsMediaCropper>
            <ProductsMediaCropper
              v-if="separateThumbnail && thumbnailPreview"
              v-show="activeImage === 'thumbnail'"
              :key="thumbnailPreview"
              :src="thumbnailPreview"
              :animation-version="animationVersion.thumbnail"
              :active="activeImage === 'thumbnail'"
              :adjustments="thumbnailAdjustments"
              :selection="initialThumbnailCrop ? (editing ? thumbnailSelection : thumbnailCrop) : undefined"
              :applied-crop="thumbnailCrop"
              :crop-selection-required="!document?.data.thumbnail?.src && !thumbnailRequested"
              :editing="editing"
              :controls-target="`#${adjustmentControlsId}`"
              :can-crop="!isGif"
              :aspect-ratio="thumbnailAspectRatio"
              :aspect-ratio-label="thumbnailAspectRatioLabel"
              :disabled="locked"
              @edit-start="beginImageEdit('thumbnail', $event)"
              @edit-end="endImageEdit"
              @update:adjustments="updateAdjustments('thumbnail', $event)"
              @update:crop="updateThumbnailCrop"
              @dimensions="thumbnailDimensions = $event"
              @error="previewError('thumbnail', $event)"
            >
              <template #crop-actions>
                <ProductsMediaCropActions :can-crop="canCropImage" @crop="cropImage" />
              </template>
            </ProductsMediaCropper>
            <p v-if="errors.image" class="error-text" role="alert">
              {{ errors.image }}
            </p>
            <div class="image-adjustment-actions image-adjustment-actions--idle">
              <UButton
                type="button"
                class="image-edit-toggle"
                :icon="editing ? 'i-lucide-file-text' : 'i-lucide-sliders-horizontal'"
                color="neutral"
                variant="outline"
                :disabled="locked || (!editing && !canAdjust)"
                :aria-controls="`${adjustmentControlsId}-${editing ? 'details' : 'adjust'}-panel`"
                @click="selectEditorTab(editing ? 'details' : 'adjust')"
                >{{
                  editing
                    ? t('products.media.editDetails')
                    : activeImage === 'thumbnail'
                      ? t('products.media.adjustThumbnail')
                      : 'Adjust image'
                }}</UButton
              >
              <UButton
                v-if="!editing && thumbnailAspectRatio && !separateThumbnail"
                type="button"
                color="neutral"
                variant="ghost"
                icon="i-lucide-image-plus"
                :disabled="locked || isGif"
                @click="resetThumbnail"
                >{{ mt('Add thumbnail') }}</UButton
              >
            </div>
            <p v-if="adjustmentStatus" class="sr-only" role="status">
              {{ adjustmentStatus }}
            </p>
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
              {{ mt('Details') }}
            </button>
            <button
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
            :aria-busy="locked"
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
            <UFormField :label="mt('Title')" name="title" required :error="errors.title"
              ><UInput
                v-model="fields.title"
                :placeholder="mt('Choir at the summer concert')"
                :disabled="locked"
                class="w-full"
            /></UFormField>
            <UFormField
              :label="mt('Description / alternative text')"
              name="alt"
              required
              :error="errors.alt"
              :description="mt('Describe the image for visitors who cannot see it.')"
              ><UTextarea
                v-model="fields.alt"
                :rows="3"
                :placeholder="mt('The choir performing on an outdoor stage')"
                :disabled="locked"
                class="w-full"
            /></UFormField>
            <UFormField :label="mt('Categories')" name="categories" :description="mt('Press Enter to add a category.')"
              ><UInputTags
                v-model="fields.categories"
                :placeholder="mt('Add a category')"
                :disabled="locked"
                class="w-full"
              />
              <div v-if="categories.some((c) => !fields.categories.includes(c))" class="category-suggestions">
                <UButton
                  v-for="c in categories.filter((c) => !fields.categories.includes(c))"
                  :key="c"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :disabled="locked"
                  @click="fields.categories.push(c)"
                  >{{ c }}</UButton
                >
              </div></UFormField
            >
            <UFormField :label="mt('Photo credit')" name="credit"
              ><UInput
                v-model="fields.credit"
                :placeholder="mt('Photographer or organisation')"
                :disabled="locked"
                class="w-full"
            /></UFormField>
            <div class="image-visibility">
              <USwitch v-model="fields.visible" :label="mt('Visible on website')" :disabled="locked" />
              <p>{{ mt('Visible images appear after you publish your changes.') }}</p>
            </div>
          </section>
          <div class="image-adjustment-footer">
            <div class="image-adjustment-toolbar">
              <!-- Reserve the action's space so hiding it cannot move the other buttons. -->
              <UButton
                v-if="!isGif"
                class="image-reset-button"
                :style="{
                  visibility: editing && canResetCrop ? undefined : 'hidden'
                }"
                :aria-hidden="!editing || !canResetCrop"
                :aria-label="mt('Reset to original')"
                :title="mt('Reset the crop to the original image')"
                type="button"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-rotate-ccw"
                :loading="reading"
                :disabled="
                  locked ||
                  !editing ||
                  !canResetCrop ||
                  !(activeImage === 'image' ? dimensions.width : thumbnailDimensions.width)
                "
                @click="resetCrop(activeImage)"
                ><span class="image-reset-label">{{ mt('Reset to original') }}</span></UButton
              >
              <div class="image-history-actions" role="group" :aria-label="mt('Edit history')">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-undo-2"
                  :disabled="locked || !editHistory.length"
                  :title="mt('Undo last change')"
                  :aria-label="mt('Undo')"
                  @click="undoAdjustments"
                  ><span class="history-label">{{ mt('Undo') }}</span></UButton
                >
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-redo-2"
                  :disabled="locked || !redoHistory.length"
                  :title="mt('Redo last change')"
                  :aria-label="mt('Redo')"
                  @click="redoAdjustments"
                  ><span class="history-label">{{ mt('Redo') }}</span></UButton
                >
              </div>
            </div>
          </div>
        </div>
      </UForm>
      <div class="image-editor-footer media-detail-footer">
        <div>
          <slot name="footer" />
        </div>
        <div>
          <UButton color="neutral" variant="outline" :disabled="locked" @click="emit('back')">{{
            mt('Cancel')
          }}</UButton>
        </div>
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
</style>
