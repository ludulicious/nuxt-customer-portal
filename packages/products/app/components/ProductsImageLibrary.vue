<script setup lang="ts">
import type { Asset, ImagePolicy, ImagePurpose } from '../../shared/types'

const props = defineProps<{
  productId: string
  assets: Asset[]
  busy: boolean
  imagePolicy: ImagePolicy
}>()
const imageIds = defineModel<string[]>('imageIds', { required: true })
const thumbnailImageId = defineModel<string | null>('thumbnailImageId', { required: true })
const galleryImageIds = defineModel<string[]>('galleryImageIds', { required: true })
const detailImageIds = defineModel<string[]>('detailImageIds', { required: true })
const emit = defineEmits<{ upload: [event: Event, purpose: ImagePurpose] }>()
const { t } = useI18n()
const api = useProducts()
const selectedId = ref(imageIds.value[0] || '')
const previewOpen = ref(false)
const selectedAsset = computed(() => props.assets.find(({ id }) => id === selectedId.value))
const imageAsset = (id: string) => props.assets.find((asset) => asset.id === id)
const purposes = ['thumbnail', 'gallery', 'detail'] as const
const activePurpose = ref<ImagePurpose>(imageAsset(selectedId.value)?.image_purpose || 'thumbnail')
const purposeImageIds = computed(() => imageIds.value.filter((id) => imageAsset(id)?.image_purpose === activePurpose.value))
const selectedIndex = computed(() => purposeImageIds.value.indexOf(selectedId.value))
const purposeCount = (purpose: ImagePurpose) => imageIds.value.filter((id) => imageAsset(id)?.image_purpose === purpose).length

watch(
  purposeImageIds,
  (ids) => {
    if (!ids.includes(selectedId.value)) {
      selectedId.value = ids[0] || ''
    }
  },
  { deep: true }
)

function selectPurpose(purpose: ImagePurpose) {
  activePurpose.value = purpose
  selectedId.value = imageIds.value.find((id) => imageAsset(id)?.image_purpose === purpose) || ''
}

function move(delta: number) {
  const index = selectedIndex.value
  const target = index + delta
  if (index < 0 || target < 0 || target >= purposeImageIds.value.length) {
    return
  }
  const currentId = purposeImageIds.value[index]!
  const targetId = purposeImageIds.value[target]!
  const ids = [...imageIds.value]
  const currentGlobalIndex = ids.indexOf(currentId)
  const targetGlobalIndex = ids.indexOf(targetId)
  ids[currentGlobalIndex] = targetId
  ids[targetGlobalIndex] = currentId
  imageIds.value = ids
  galleryImageIds.value = ids.filter((imageId) => galleryImageIds.value.includes(imageId))
  detailImageIds.value = ids.filter((imageId) => detailImageIds.value.includes(imageId))
}

function removeSelected() {
  const index = imageIds.value.indexOf(selectedId.value)
  if (index < 0) {
    return
  }
  const nextPurposeId = purposeImageIds.value.filter((id) => id !== selectedId.value)[Math.min(selectedIndex.value, purposeImageIds.value.length - 2)] || ''
  const ids = [...imageIds.value]
  ids.splice(index, 1)
  imageIds.value = ids
  if (thumbnailImageId.value === selectedId.value) {
    thumbnailImageId.value = null
  }
  galleryImageIds.value = galleryImageIds.value.filter((id) => id !== selectedId.value)
  detailImageIds.value = detailImageIds.value.filter((id) => id !== selectedId.value)
  selectedId.value = nextPurposeId
}
</script>

<template>
  <fieldset class="space-y-4">
    <legend class="sr-only">{{ t('products.productImageLibrary') }}</legend>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">{{ t('products.productImageLibraryHelp') }}</p>
      <div class="flex flex-wrap gap-2">
        <UBadge :color="thumbnailImageId ? 'success' : 'warning'" variant="subtle">
          {{ t('products.thumbnailCount', { count: thumbnailImageId ? 1 : 0 }) }}
        </UBadge>
        <UBadge :color="galleryImageIds.length ? 'success' : 'warning'" variant="subtle">
          {{ t('products.galleryCount', { count: galleryImageIds.length }) }}
        </UBadge>
        <UBadge :color="detailImageIds.length ? 'success' : 'warning'" variant="subtle">
          {{ t('products.detailsCount', { count: detailImageIds.length }) }}
        </UBadge>
      </div>
    </div>

    <UFormField name="imageIds">
      <div class="space-y-4">
        <div class="grid gap-1 rounded-lg bg-elevated p-1 sm:grid-cols-3" role="tablist" :aria-label="t('products.imagePurpose')">
          <button
            v-for="purpose in purposes"
            :key="purpose"
            type="button"
            role="tab"
            class="flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-primary"
            :class="activePurpose === purpose ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:bg-default/60 hover:text-highlighted'"
            :aria-selected="activePurpose === purpose"
            @click="selectPurpose(purpose)"
          >
            <span class="flex size-9 shrink-0 items-center justify-center rounded-md" :class="activePurpose === purpose ? 'bg-primary/10 text-primary' : 'bg-muted'">
              <UIcon :name="purpose === 'thumbnail' ? 'i-lucide-square' : purpose === 'gallery' ? 'i-lucide-rectangle-vertical' : 'i-lucide-rectangle-horizontal'" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-medium">{{ t(`products.imagePurpose${purpose}`) }}</span>
                <UBadge size="xs" color="neutral" variant="subtle">{{ purposeCount(purpose) }}</UBadge>
              </span>
              <span class="mt-0.5 block text-xs text-muted">
                {{ imagePolicy[purpose].width }} × {{ imagePolicy[purpose].height }}
              </span>
            </span>
          </button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted">
            {{ t(`products.imagePurpose${activePurpose}`) }} · {{ imagePolicy[activePurpose].width }} × {{ imagePolicy[activePurpose].height }}
          </p>
          <label
            class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition"
            :class="activePurpose === 'thumbnail' && purposeCount('thumbnail') >= 1
              ? 'cursor-not-allowed bg-muted text-dimmed'
              : 'cursor-pointer bg-primary text-inverted hover:bg-primary/90'"
            :aria-disabled="busy || (activePurpose === 'thumbnail' && purposeCount('thumbnail') >= 1)"
          >
            <UIcon name="i-lucide-upload" class="size-4" />
            {{ t(`products.uploadPurpose${activePurpose}`) }}
            <input
              type="file"
              class="sr-only"
              :multiple="activePurpose !== 'thumbnail'"
              accept="image/png,image/jpeg,image/webp,image/avif"
              :disabled="busy || (activePurpose === 'thumbnail' && purposeCount('thumbnail') >= 1)"
              @change="emit('upload', $event, activePurpose)"
            />
          </label>
        </div>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div class="rounded-lg border border-default bg-elevated/20 p-3">
            <div v-if="purposeImageIds.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <button
                v-for="(id, index) in purposeImageIds"
                :key="id"
                type="button"
                class="group relative aspect-square overflow-hidden rounded-lg border bg-muted text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :class="selectedId === id ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-primary/60'"
                :aria-label="t('products.selectImage', { number: index + 1 })"
                :aria-pressed="selectedId === id"
                @click="selectedId = id"
              >
                <img
                  :src="api.previewImageUrl(productId, id)"
                  :alt="imageAsset(id)?.name || t('products.imageNumber', { number: index + 1 })"
                  class="absolute inset-0 size-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-7 text-xs text-white">
                  {{ index + 1 }} · {{ imageAsset(id)?.width || '—' }} × {{ imageAsset(id)?.height || '—' }}
                </span>
              </button>
            </div>
            <div v-else class="flex min-h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-default text-center text-muted">
              <UIcon name="i-lucide-images" class="size-8" />
              <p class="text-sm font-medium">{{ t('products.noProductImages') }}</p>
              <p class="max-w-xs text-xs">{{ t('products.chooseImageToStart') }}</p>
            </div>
          </div>

          <aside class="rounded-lg border border-default bg-elevated/30 p-3">
          <template v-if="selectedId">
            <button
              type="button"
              class="group relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              :aria-label="t('products.previewImage')"
              @click="previewOpen = true"
            >
              <img
                :src="api.previewImageUrl(productId, selectedId)"
                :alt="selectedAsset?.name || t('products.previewImage')"
                class="size-full object-cover"
              />
              <span class="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                <UIcon name="i-lucide-expand" class="size-6 text-white opacity-0 transition group-hover:opacity-100" />
              </span>
            </button>
            <div class="mt-3 space-y-1">
              <p class="truncate text-sm font-medium">{{ selectedAsset?.name }}</p>
              <p class="text-xs text-muted">
                {{ selectedAsset?.width || '—' }} × {{ selectedAsset?.height || '—' }}
              </p>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <UButton
                v-if="activePurpose !== 'thumbnail'"
                color="neutral"
                variant="outline"
                icon="i-lucide-arrow-left"
                :disabled="selectedIndex <= 0"
                @click="move(-1)"
              >{{ t('products.moveEarlier') }}</UButton>
              <UButton
                v-if="activePurpose !== 'thumbnail'"
                color="neutral"
                variant="outline"
                trailing-icon="i-lucide-arrow-right"
                :disabled="selectedIndex >= purposeImageIds.length - 1"
                @click="move(1)"
              >{{ t('products.moveLater') }}</UButton>
              <UButton
                class="col-span-2 justify-center"
                color="error"
                variant="subtle"
                icon="i-lucide-trash-2"
                @click="removeSelected"
              >{{ t('products.removeImage') }}</UButton>
            </div>
            <p class="mt-2 text-xs text-muted">{{ t('products.removeImageHelp') }}</p>
          </template>
          <div v-else class="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center text-muted">
            <UIcon name="i-lucide-mouse-pointer-2" class="size-7" />
            <p class="text-sm font-medium">{{ t('products.selectImageToEdit') }}</p>
          </div>
          </aside>
        </div>
      </div>
    </UFormField>
  </fieldset>

  <UModal v-if="previewOpen" v-model:open="previewOpen" :title="selectedAsset?.name || t('products.previewImage')">
    <template #body>
      <img
        v-if="selectedId"
        :src="api.previewImageUrl(productId, selectedId)"
        :alt="selectedAsset?.name || t('products.previewImage')"
        class="max-h-[75vh] w-full object-contain"
      />
    </template>
  </UModal>
</template>
