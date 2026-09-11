<script setup lang="ts">
import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'
import { z } from 'zod'
import type { Product, Asset, ProductCategory, ImagePolicy, ImagePurpose } from '../../shared/types'
import { emptyProduct, productSchema, productCreateSchema, hasRequiredPrices } from '../../shared/validation'
import { currencyScale } from '../../shared/money'

const props = withDefaults(
    defineProps<{
      product?: Product
      section?: 'create' | 'all' | 'basic' | 'details' | 'pricing' | 'media' | 'images' | 'files'
      currency?: string
      language?: 'en' | 'nl'
    }>(),
    {
      section: 'all'
    }
  ),
  emit = defineEmits<{ saved: [product: Product]; cancel: [] }>()
const { t } = useI18n(),
  api = useProducts(),
  schema = useProductFormSchema(productSchema),
  toast = useToast()
const state = reactive<z.infer<typeof productSchema>>(
  props.product
    ? {
        isFree: false,
        ...structuredClone(toRaw(props.product)),
        content: {
          en: {
            ...structuredClone(toRaw(props.product.content.en)),
            subtitle: props.product.content.en.subtitle || '',
            secondaryCta: props.product.content.en.secondaryCta || ''
          },
          nl: {
            ...structuredClone(toRaw(props.product.content.nl)),
            subtitle: props.product.content.nl.subtitle || '',
            secondaryCta: props.product.content.nl.secondaryCta || ''
          }
        },
        prices: props.product.isFree ? [] : structuredClone(toRaw(props.product.prices))
      }
    : { ...emptyProduct(), prices: [] }
)
for (const id of state.fileIds) {
  state.fileNames[id] ||= { en: '', nl: '' }
}
const busy = ref(false),
  saving = ref(false),
  error = ref(''),
  assets = ref<Asset[]>([]),
  form = useTemplateRef('form'),
  root = useTemplateRef('root')
function syncThumbnailImageId() {
  if (!state.thumbnailImageId) {
    state.thumbnailImageId =
      state.imageIds.find((id) => assets.value.find((asset) => asset.id === id)?.image_purpose === 'thumbnail') || null
  }
}
const categories = ref<ProductCategory[]>([])
const categoriesOpen = ref(false)
const categoryOptions = computed(() => [
  ...(props.section === 'create' ? [] : [{ label: t('products.noCategory'), value: 'none' }]),
  ...categories.value.map((category) => ({
    label: category.content[defaultLanguage.value].name || category.name,
    value: `category:${category.id}`
  }))
])
const selectedCategory = computed({
  get: () => (state.categoryId ? `category:${state.categoryId}` : props.section === 'create' ? undefined : 'none'),
  set: (value: string | undefined) => {
    state.categoryId = !value || value === 'none' ? null : value.slice('category:'.length)
  }
})
async function loadCategories() {
  categories.value = await api.categories()
}
async function categorySaved(category: ProductCategory) {
  state.categoryId = category.id
  categoriesOpen.value = false
  await loadCategories()
}
const selectedLanguage = ref<'en' | 'nl'>(props.language || 'en')
const defaultLanguage = ref<'en' | 'nl'>('en')
const createSchema = computed(() =>
  useProductFormSchema(
    z.object({ ...productCreateSchema.shape }).superRefine((value, context) => {
      if (!value.content[defaultLanguage.value].title.trim()) {
        context.addIssue({ code: 'custom', path: ['content', defaultLanguage.value, 'title'], message: 'required' })
      }
    }),
    (issue) => {
      if (issue.path[0] === 'content' && issue.code === 'custom') {
        return t('products.productNameRequired')
      }
      if (issue.path[0] === 'slug' && !state.slug.trim()) {
        return t('products.slugRequired')
      }
    }
  )
)
const supportedLanguages = ref<('en' | 'nl')[]>([])
const languageReady = ref(false)
const languageOptions = computed(() =>
  [defaultLanguage.value, ...supportedLanguages.value.filter((value) => value !== defaultLanguage.value)].map(
    (value) => ({
      value,
      disabled: !languageReady.value,
      label: portalLanguages.find((language) => language.value === value)!.label
    })
  )
)
async function showInvalidLanguage(event: { errors: Array<{ name?: string }> }) {
  const field = event.errors.find(({ name }) => /^(content|nextSteps)\.(en|nl)(\.|$)/.test(name || ''))
  const language = field?.name?.split('.')[1]
  if (language === 'en' || language === 'nl') {
    selectedLanguage.value = language
  }
  await nextTick()
  const invalid = root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  invalid?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  invalid?.focus({ preventScroll: true })
}
const currencies = ref<string[]>([])
const settingsReady = ref(false)
const imagePolicy = ref<ImagePolicy>({
  thumbnail: { width: 400, height: 400 },
  gallery: { width: 800, height: 1000 },
  detail: { width: 1200, height: 900 }
})
const pendingImage = ref<{ file: File; url: string; width: number; height: number; purpose: ImagePurpose }>()
const imageQueue = ref<Array<{ file: File; purpose: ImagePurpose }>>([])
const purchasedFilesUploading = ref(false)
const cropTarget = computed(() => imagePolicy.value[pendingImage.value?.purpose || 'gallery'])
const cropFocus = reactive({ x: 50, y: 50 })
const zoom = ref(1)
const cropViewport = useTemplateRef('cropViewport')
const pointers = new Map<number, { x: number; y: number }>()
let pinchDistance = 0
const baseCrop = computed(() => {
  if (!pendingImage.value) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  const sourceRatio = pendingImage.value.width / pendingImage.value.height
  const targetRatio = cropTarget.value.width / cropTarget.value.height
  const width = sourceRatio > targetRatio ? targetRatio / sourceRatio : 1
  const height = sourceRatio > targetRatio ? 1 : sourceRatio / targetRatio
  return { width, height }
})
const maximumZoom = computed(() => {
  if (!pendingImage.value) {
    return 1
  }
  return Math.max(
    1,
    Math.min(
      3,
      (baseCrop.value.width * pendingImage.value.width) / cropTarget.value.width,
      (baseCrop.value.height * pendingImage.value.height) / cropTarget.value.height
    )
  )
})
const crop = computed(() => {
  const width = baseCrop.value.width / zoom.value
  const height = baseCrop.value.height / zoom.value
  return {
    x: ((1 - width) * cropFocus.x) / 100,
    y: ((1 - height) * cropFocus.y) / 100,
    width,
    height
  }
})
const cropLargeEnough = computed(
  () =>
    !!pendingImage.value &&
    crop.value.width * pendingImage.value.width >= cropTarget.value.width &&
    crop.value.height * pendingImage.value.height >= cropTarget.value.height
)
const visiblePrices = computed(() =>
  state.prices
    .map((price, index) => ({ price, index }))
    .filter(({ price }) => !props.currency || price.currency === props.currency)
)
const pricingErrors = () =>
  state.status === 'published' && !state.isFree && !hasRequiredPrices(state, currencies.value)
    ? [{ name: 'prices', message: t('products.requiredPrices') }]
    : []
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
function setZoom(value: number) {
  zoom.value = clamp(value, 1, maximumZoom.value)
}
function pointerDown(event: PointerEvent) {
  cropViewport.value?.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2) {
    const [first, second] = [...pointers.values()]
    pinchDistance = Math.hypot(second!.x - first!.x, second!.y - first!.y)
  }
}
function pointerMove(event: PointerEvent) {
  const previous = pointers.get(event.pointerId)
  if (!previous) {
    return
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2) {
    const [first, second] = [...pointers.values()]
    const distance = Math.hypot(second!.x - first!.x, second!.y - first!.y)
    if (pinchDistance) {
      setZoom(zoom.value * (distance / pinchDistance))
    }
    pinchDistance = distance
    return
  }
  const bounds = cropViewport.value?.getBoundingClientRect()
  if (!bounds) {
    return
  }
  cropFocus.x = clamp(cropFocus.x - ((event.clientX - previous.x) / bounds.width) * 100, 0, 100)
  cropFocus.y = clamp(cropFocus.y - ((event.clientY - previous.y) / bounds.height) * 100, 0, 100)
}
function pointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  pinchDistance = 0
}
function cropKeyboard(event: KeyboardEvent) {
  const movements: Record<string, [number, number]> = {
    ArrowLeft: [-2, 0],
    ArrowRight: [2, 0],
    ArrowUp: [0, -2],
    ArrowDown: [0, 2]
  }
  if (movements[event.key]) {
    event.preventDefault()
    cropFocus.x = clamp(cropFocus.x + movements[event.key]![0], 0, 100)
    cropFocus.y = clamp(cropFocus.y + movements[event.key]![1], 0, 100)
  } else if (event.key === '+' || event.key === '=') {
    setZoom(zoom.value + 0.1)
  } else if (event.key === '-') {
    setZoom(zoom.value - 0.1)
  }
}
watch(
  () => state.isFree,
  (free) => {
    if (free) {
      state.prices = []
    } else {
      state.prices = currencies.value.map((currency) => ({ currency, amount: 0, taxBehavior: 'inclusive' }))
    }
  }
)
const slugManuallyEdited = ref(false)
const createName = computed({
  get: () => state.content[defaultLanguage.value].title,
  set: (value: string) => {
    state.content[defaultLanguage.value].title = value
    if (!slugManuallyEdited.value) {
      state.slug = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120)
        .replace(/-$/g, '')
    }
  }
})
const types = computed(() => ['digital', 'service'].map((value) => ({ value, label: t(`products.${value}`) })))
onMounted(async () => {
  if (props.section === 'create' || props.section === 'all' || props.section === 'details') {
    await loadCategories().catch(() => {
      error.value = t('products.loadFailed')
    })
  }
  try {
    const settings = await api.settings()
    currencies.value = settings.currencies
    imagePolicy.value = settings.imagePolicy
    if (!state.isFree && (props.section === 'create' || props.section === 'all' || props.section === 'pricing')) {
      state.prices = settings.currencies.map(
        (currency) =>
          state.prices.find((price) => price.currency === currency) || { currency, amount: 0, taxBehavior: 'inclusive' }
      )
    }
    settingsReady.value = true
    supportedLanguages.value = settings.languages
    defaultLanguage.value = settings.defaultLocale
    selectedLanguage.value = props.language || settings.defaultLocale
  } catch {
    error.value = t('products.languageLoadFailed')
  } finally {
    languageReady.value = true
  }
  if (props.product && ['all', 'media', 'images', 'files'].includes(props.section)) {
    assets.value = await api.assets(props.product!.id)
    syncThumbnailImageId()
  }
  await nextTick()
  root.value?.querySelector('input')?.focus({ preventScroll: true })
})
async function save() {
  syncThumbnailImageId()
  const missingFileName = state.fileIds.flatMap((id) =>
    supportedLanguages.value
      .filter((language) => !state.fileNames[id]?.[language]?.trim())
      .map((language) => `fileNames.${id}.${language}`)
  )[0]
  if (missingFileName) {
    form.value?.setErrors([{ name: missingFileName, message: t('products.fileNameRequired') }])
    await nextTick()
    root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  saving.value = true
  error.value = ''
  try {
    emit('saved', await api.save(state, props.product?.id))
  } catch (e) {
    error.value = t('products.saveFailed')
    const field = (e as { data?: { data?: { field?: string } } }).data?.data?.field
    if (field) {
      form.value?.setErrors([
        {
          name: field,
          message: field.startsWith('fileNames.') ? t('products.fileNameRequired') : t('products.conflict')
        }
      ])
    }
    await nextTick()
    root.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } finally {
    saving.value = false
  }
}
async function upload(event: Event, visibility: 'public' | 'private', purpose?: ImagePurpose) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files || [])]
  if (!files.length || !props.product) {
    return
  }
  input.value = ''
  if (visibility === 'public') {
    if (!purpose) {
      return
    }
    imageQueue.value.push(...files.map((file) => ({ file, purpose })))
    openNextImage()
    return
  }
  await performUpload(files[0]!, visibility)
}
function openNextImage() {
  if (pendingImage.value) {
    return
  }
  const queued = imageQueue.value.shift()
  if (!queued) {
    return
  }
  const url = URL.createObjectURL(queued.file),
    image = new Image()
  image.onload = () => {
    pendingImage.value = { ...queued, url, width: image.naturalWidth, height: image.naturalHeight }
    cropFocus.x = 50
    cropFocus.y = 50
    zoom.value = 1
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    error.value = t('products.invalidImage')
    openNextImage()
  }
  image.src = url
}
async function performUpload(
  file: File,
  visibility: 'public' | 'private',
  selectedCrop?: { x: number; y: number; width: number; height: number },
  purpose?: ImagePurpose,
  trackBusy = true
) {
  if (trackBusy) {
    busy.value = true
  }
  error.value = ''
  try {
    const id = await api.upload(props.product!.id, file, visibility, selectedCrop, purpose)
    if (visibility === 'public') {
      state.imageIds.push(id)
      if (purpose === 'thumbnail') {
        state.thumbnailImageId = id
      } else if (purpose === 'gallery') {
        state.galleryImageIds.push(id)
      } else if (purpose === 'detail') {
        state.detailImageIds.push(id)
      }
    } else {
      state.fileIds.push(id)
      state.fileNames[id] = { en: '', nl: '' }
    }
    assets.value = await api.assets(props.product!.id)
  } catch (uploadError) {
    toast.add({
      title: t('products.uploadFailed'),
      description: uploadError instanceof Error ? uploadError.message : undefined,
      color: 'error'
    })
  } finally {
    if (trackBusy) {
      busy.value = false
    }
  }
}
async function confirmCrop() {
  if (!pendingImage.value || !cropLargeEnough.value) {
    return
  }
  const current = pendingImage.value
  await performUpload(current.file, 'public', crop.value, current.purpose)
  URL.revokeObjectURL(current.url)
  pendingImage.value = undefined
  openNextImage()
}
function cancelCrop() {
  if (pendingImage.value) {
    URL.revokeObjectURL(pendingImage.value.url)
  }
  pendingImage.value = undefined
  imageQueue.value = []
}
function move(ids: string[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= ids.length) {
    return
  }
  const [id] = ids.splice(index, 1)
  ids.splice(target, 0, id!)
}
function removeFile(id: string, index: number) {
  Reflect.deleteProperty(state.fileNames, id)
  state.fileIds.splice(index, 1)
}
</script>

<template>
  <div ref="root" class="scroll-mt-24" @keydown.esc.stop="emit('cancel')">
    <UForm
      ref="form"
      :state="state"
      :schema="section === 'create' ? createSchema : schema"
      :validate="pricingErrors"
      novalidate
      class="space-y-5"
      @submit="save"
      @error="showInvalidLanguage"
    >
      <UAlert v-if="error" color="error" :title="error" />
      <UAlert
        v-if="settingsReady && (section === 'basic' || section === 'media') && pricingErrors().length"
        color="warning"
        :title="t('products.requiredPrices')"
      />
      <UFormField
        v-if="section === 'create'"
        :name="`content.${defaultLanguage}.title`"
        :label="t('products.name')"
        required
      >
        <UInput v-model="createName" :disabled="!settingsReady" class="w-full" />
      </UFormField>
      <template v-if="section === 'create' || section === 'all' || section === 'details'">
        <div :class="section === 'details' ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2'">
          <UFormField name="slug" :label="t('products.slug')" :required="section === 'create'"
            ><UInput v-model="state.slug" class="w-full" @update:model-value="slugManuallyEdited = true" /></UFormField
          ><UFormField name="categoryId" :label="t('products.category')" :required="section === 'create'"
            ><div class="flex gap-2">
              <USelectMenu
                v-model="selectedCategory"
                :items="categoryOptions"
                value-key="value"
                :placeholder="t('products.selectCategory')"
                class="min-w-0 flex-1"
              />
              <UButton
                icon="i-lucide-plus"
                variant="outline"
                :aria-label="t('products.addCategory')"
                @click="categoriesOpen = true"
              /></div></UFormField
          ><UFormField name="type" :label="t('products.type')" :required="section === 'create'"
            ><USelect v-model="state.type" :items="types" class="w-full" /></UFormField
          ><UFormField v-if="section !== 'create'" name="status" :label="t('products.status')"
            ><div class="flex min-h-8 items-center gap-3">
              <UBadge color="neutral" variant="subtle">{{ t(`products.${state.status}`) }}</UBadge>
            </div></UFormField
          >
        </div>
      </template>
      <template v-if="section === 'all' || section === 'basic'">
        <UTabs
          v-model="selectedLanguage"
          :items="languageOptions"
          variant="link"
          :ui="{ list: language ? 'hidden' : 'justify-start', trigger: 'grow-0' }"
        >
          <template #content="{ item }">
            <div class="space-y-3 pt-4">
              <UFormField :name="`content.${item.value}.title`" :label="t('products.name')"
                ><UInput v-model="state.content[item.value].title" class="w-full" /></UFormField
              ><UFormField :name="`content.${item.value}.subtitle`" :label="t('products.subtitle')"
                ><UInput v-model="state.content[item.value].subtitle" class="w-full" /></UFormField
              ><UFormField :name="`content.${item.value}.secondaryCta`" :label="t('products.secondaryCta')"
                ><UInput
                  v-model="state.content[item.value].secondaryCta"
                  :placeholder="t('products.secondaryCtaPlaceholder')"
                  class="w-full" /></UFormField
              ><UFormField :name="`content.${item.value}.summary`" :label="t('products.summary')"
                ><UTextarea
                  v-model="state.content[item.value].summary"
                  :rows="4"
                  autoresize
                  class="w-full" /></UFormField
              ><UFormField
                :name="`content.${item.value}.description`"
                :label="t('products.description')"
                :help="t('products.markdownHelp')"
                ><UTextarea
                  v-model="state.content[item.value].description"
                  :rows="15"
                  autoresize
                  class="w-full" /></UFormField
              ><UFormField :name="`nextSteps.${item.value}`" :label="t('products.nextSteps')"
                ><UTextarea v-model="state.nextSteps[item.value]" class="w-full"
              /></UFormField>
            </div>
          </template>
        </UTabs>
      </template>
      <template v-if="section === 'create' || section === 'all' || section === 'details'">
        <UFormField
          name="isFree"
          :label="t('products.freeProduct')"
          :help="product?.status === 'published' ? t('products.publishedPricingLocked') : undefined"
        >
          <USwitch v-model="state.isFree" :disabled="product?.status === 'published'" />
        </UFormField>
        <UFormField v-if="section !== 'create'" name="taxCode" :label="t('products.taxCode')"
          ><UInput v-model="state.taxCode" class="w-full sm:max-w-xs"
        /></UFormField>
      </template>
      <template v-if="section === 'all' || section === 'pricing'">
        <UFormField
          v-if="!state.isFree"
          name="prices"
          :label="currency ? undefined : t('products.prices')"
          :help="currency ? undefined : t('products.requiredPrices')"
          ><div class="space-y-3">
            <div
              v-for="{ price, index } in visiblePrices"
              :key="index"
              :class="currency ? 'grid gap-4' : 'flex flex-wrap items-end gap-3'"
            >
              <UFormField v-if="!currency" :name="`prices.${index}.currency`" :label="t('products.currency')"
                ><span class="block py-2 font-medium">{{ price.currency }}</span></UFormField
              ><UFormField :name="`prices.${index}.amount`" :label="t('products.amount')"
                ><UInputNumber
                  class="w-full"
                  :format-options="{
                    style: 'currency',
                    currency: price.currency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }"
                  :increment="false"
                  :decrement="false"
                  :step="1 / currencyScale(price.currency || 'EUR')"
                  :model-value="price.amount / currencyScale(price.currency || 'EUR')"
                  @update:model-value="
                    price.amount = Math.round(Number($event) * currencyScale(price.currency || 'EUR'))
                  "
              /></UFormField>
            </div></div
        ></UFormField>
      </template>
      <template v-if="section === 'all' || section === 'media'">
        <UFormField name="videoUrl" :label="t('products.videoUrl')"
          ><UInput v-model="state.videoUrl" class="w-full"
        /></UFormField>
      </template>
      <template v-if="section === 'all' || section === 'images' || section === 'files'">
        <p v-if="!product" class="text-muted">{{ t('products.saveBeforeUpload') }}</p>
        <template v-else>
          <ProductsImageLibrary
            v-if="section === 'all' || section === 'images'"
            v-model:image-ids="state.imageIds"
            v-model:thumbnail-image-id="state.thumbnailImageId"
            v-model:gallery-image-ids="state.galleryImageIds"
            v-model:detail-image-ids="state.detailImageIds"
            :product-id="product.id"
            :assets="assets"
            :busy="busy"
            :image-policy="imagePolicy"
            @upload="(event, purpose) => upload(event, 'public', purpose)"
          />
          <div v-if="section === 'all' || section === 'files'" class="space-y-3">
            <UFormField name="fileIds">
              <div class="space-y-2">
                <div
                  v-for="(id, index) in state.fileIds"
                  :key="id"
                  class="space-y-3 rounded-lg border border-default p-3"
                >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-file" class="size-5 shrink-0 text-muted" />
                    <span class="min-w-0 flex-1 truncate text-sm text-muted">{{
                      assets.find((a) => a.id === id)?.name || id
                    }}</span>
                    <UButton
                      icon="i-lucide-arrow-up"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('products.moveUp')"
                      :disabled="index === 0"
                      @click="move(state.fileIds, index, -1)"
                    />
                    <UButton
                      icon="i-lucide-arrow-down"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('products.moveDown')"
                      :disabled="index === state.fileIds.length - 1"
                      @click="move(state.fileIds, index, 1)"
                    />
                    <UButton
                      icon="i-lucide-x"
                      color="error"
                      variant="ghost"
                      :aria-label="t('products.removeFile')"
                      @click="removeFile(id, index)"
                    />
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <UFormField
                      v-for="languageOption in languageOptions"
                      :key="languageOption.value"
                      :name="`fileNames.${id}.${languageOption.value}`"
                      :label="t('products.fileNameInLanguage', { language: languageOption.label })"
                    >
                      <UInput v-model="state.fileNames[id]![languageOption.value]" class="w-full" />
                    </UFormField>
                  </div>
                </div>
              </div>
            </UFormField>
            <ProductsPurchasedFileUpload
              :disabled="saving"
              :upload="(file) => performUpload(file, 'private', undefined, undefined, false)"
              @update:uploading="purchasedFilesUploading = $event"
            />
          </div>
        </template>
      </template>
      <div class="flex justify-end gap-3">
        <UButton
          variant="outline"
          color="neutral"
          :disabled="busy || saving || purchasedFilesUploading"
          @click="emit('cancel')"
          >{{ t('products.cancel') }}</UButton
        ><UButton
          type="submit"
          :loading="saving"
          :disabled="busy || saving || purchasedFilesUploading || !settingsReady"
          >{{ t('products.save') }}</UButton
        >
      </div></UForm
    >
  </div>
  <UModal v-model:open="categoriesOpen" :title="t('products.addCategory')" :ui="{ content: 'pointer-events-auto' }">
    <template #body><ProductsCategoryForm embedded @saved="categorySaved" @cancel="categoriesOpen = false" /></template>
  </UModal>
  <UModal
    :open="!!pendingImage"
    :title="t('products.cropImage')"
    :dismissible="!busy"
    @update:open="(open) => !open && cancelCrop()"
  >
    <template #body
      ><div v-if="pendingImage" class="space-y-4">
        <p class="text-sm text-muted">
          {{
            t('products.cropPurposeHelp', {
              purpose: t(`products.imagePurpose${pendingImage.purpose}`),
              width: cropTarget.width,
              height: cropTarget.height
            })
          }}
        </p>
        <div
          ref="cropViewport"
          class="mx-auto w-full max-w-xl cursor-grab touch-none overflow-hidden rounded-lg bg-muted active:cursor-grabbing"
          :style="{ aspectRatio: `${cropTarget.width}/${cropTarget.height}` }"
          role="application"
          tabindex="0"
          :aria-label="t('products.cropInteraction')"
          @pointerdown="pointerDown"
          @pointermove="pointerMove"
          @pointerup="pointerUp"
          @pointercancel="pointerUp"
          @wheel.prevent="setZoom(zoom + ($event.deltaY < 0 ? 0.1 : -0.1))"
          @keydown="cropKeyboard"
        >
          <img
            :src="pendingImage.url"
            :alt="t('products.cropPreview')"
            class="size-full touch-none select-none object-cover"
            :style="{
              objectPosition: `${cropFocus.x}% ${cropFocus.y}%`,
              transform: `scale(${zoom})`,
              transformOrigin: `${cropFocus.x}% ${cropFocus.y}%`
            }"
            draggable="false"
          />
        </div>
        <p class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-move" class="size-4" />{{ t('products.cropGestureHelp') }}
        </p>
        <UAlert v-if="!cropLargeEnough" color="error" :title="t('products.imageTooSmall')" />
        <UFormField :label="t('products.zoom')">
          <input
            :value="zoom"
            type="range"
            min="1"
            :max="maximumZoom"
            step="0.01"
            class="w-full"
            @input="setZoom(Number(($event.target as HTMLInputElement).value))"
          />
        </UFormField>
        <UFormField :label="t('products.horizontalPosition')"
          ><input v-model.number="cropFocus.x" type="range" min="0" max="100" class="w-full"
        /></UFormField>
        <UFormField :label="t('products.verticalPosition')"
          ><input v-model.number="cropFocus.y" type="range" min="0" max="100" class="w-full"
        /></UFormField>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" color="neutral" :disabled="busy" @click="cancelCrop">{{
            t('products.cancel')
          }}</UButton>
          <UButton :loading="busy" :disabled="!cropLargeEnough" @click="confirmCrop">{{
            t('products.uploadImage')
          }}</UButton>
        </div>
      </div></template
    >
  </UModal>
</template>
