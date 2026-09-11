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
const selectedIndex = computed(() => imageIds.value.indexOf(selectedId.value))
const selectedAsset = computed(() => props.assets.find(({ id }) => id === selectedId.value))
const imageAsset = (id: string) => props.assets.find((asset) => asset.id === id)
const purposes = ['thumbnail', 'gallery', 'detail'] as const

watch(
  imageIds,
  (ids) => {
    if (!ids.includes(selectedId.value)) {
      selectedId.value = ids[0] || ''
    }
  },
  { deep: true }
)

function move(delta: number) {
  const index = selectedIndex.value
  const target = index + delta
  if (index < 0 || target < 0 || target >= imageIds.value.length) {
    return
  }
  const ids = [...imageIds.value]
  const [id] = ids.splice(index, 1)
  ids.splice(target, 0, id!)
  imageIds.value = ids
  galleryImageIds.value = ids.filter((imageId) => galleryImageIds.value.includes(imageId))
  detailImageIds.value = ids.filter((imageId) => detailImageIds.value.includes(imageId))
}

function removeSelected() {
  const index = selectedIndex.value
  if (index < 0) {
    return
  }
  const ids = [...imageIds.value]
  ids.splice(index, 1)
  imageIds.value = ids
  if (thumbnailImageId.value === selectedId.value) {
    thumbnailImageId.value = null
  }
  galleryImageIds.value = galleryImageIds.value.filter((id) => id !== selectedId.value)
  detailImageIds.value = detailImageIds.value.filter((id) => id !== selectedId.value)
  selectedId.value = ids[Math.min(index, ids.length - 1)] || ''
}
</script>

<template>
  <fieldset class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <legend class="font-medium">{{ t('products.productImageLibrary') }}</legend>
        <p class="mt-1 text-sm text-muted">
          {{ t('products.productImageLibraryHelp') }}
        </p>
      </div>
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
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div class="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <label
            v-for="purpose in purposes"
            :key="purpose"
            class="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-default bg-elevated/30 p-4 text-center transition hover:border-primary hover:bg-primary/5"
          >
            <UIcon name="i-lucide-image-plus" class="size-7 text-primary" />
            <span class="text-sm font-medium">{{ t(`products.uploadPurpose${purpose}`) }}</span>
            <span class="text-xs text-muted">
              {{ imagePolicy[purpose].width }} × {{ imagePolicy[purpose].height }} · {{ t('products.uploadImagesHelp') }}
            </span>
            <input
              type="file"
              class="sr-only"
              multiple
              accept="image/png,image/jpeg,image/webp,image/avif"
              :disabled="busy"
              @change="emit('upload', $event, purpose)"
            />
          </label>

          <button
            v-for="(id, index) in imageIds"
            :key="id"
            type="button"
            class="group relative min-h-32 overflow-hidden rounded-lg border bg-elevated text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="selectedId === id ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-muted'"
            :aria-label="t('products.selectImage', { number: index + 1 })"
            :aria-pressed="selectedId === id"
            @click="selectedId = id"
          >
            <img
              :src="api.previewImageUrl(productId, id)"
              :alt="imageAsset(id)?.name || t('products.imageNumber', { number: index + 1 })"
              class="absolute inset-0 size-full object-cover"
              loading="lazy"
            />
            <span class="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-xs text-white">
              {{ index + 1 }} · {{ imageAsset(id)?.width || '—' }} × {{ imageAsset(id)?.height || '—' }}
            </span>
            <span class="absolute left-2 top-2 flex gap-1">
              <UBadge v-if="thumbnailImageId === id" size="xs" color="primary" variant="solid">{{ t('products.thumbnailShort') }}</UBadge>
              <UBadge v-if="galleryImageIds.includes(id)" size="xs" color="neutral" variant="solid">{{ t('products.galleryShort') }}</UBadge>
              <UBadge v-if="detailImageIds.includes(id)" size="xs" color="neutral" variant="solid">{{ t('products.detailsShort') }}</UBadge>
            </span>
          </button>
        </div>

        <div class="min-h-64 rounded-lg border border-default bg-elevated/30 p-3">
          <template v-if="selectedId">
            <button
              type="button"
              class="block aspect-square w-full overflow-hidden rounded-md bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              :aria-label="t('products.previewImage')"
              @click="previewOpen = true"
            >
              <img
                :src="api.previewImageUrl(productId, selectedId)"
                :alt="selectedAsset?.name || t('products.previewImage')"
                class="size-full object-contain"
              />
            </button>
            <div class="mt-3 space-y-1">
              <p class="truncate text-sm font-medium">{{ selectedAsset?.name }}</p>
              <p class="text-xs text-muted">
                {{ selectedAsset?.width || '—' }} × {{ selectedAsset?.height || '—' }}
              </p>
            </div>
            <div class="mt-4 rounded-md border border-default p-3 text-sm">
              <p class="font-medium">{{ t('products.imagePurpose') }}</p>
              <p class="mt-1 text-muted">
                {{ selectedAsset?.image_purpose ? t(`products.imagePurpose${selectedAsset.image_purpose}`) : t('products.legacyImagePurpose') }}
              </p>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-arrow-left"
                :disabled="selectedIndex <= 0"
                @click="move(-1)"
              >{{ t('products.moveEarlier') }}</UButton>
              <UButton
                color="neutral"
                variant="outline"
                trailing-icon="i-lucide-arrow-right"
                :disabled="selectedIndex >= imageIds.length - 1"
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
          <div v-else class="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-center text-muted">
            <UIcon name="i-lucide-images" class="size-8" />
            <p class="text-sm font-medium">{{ t('products.noProductImages') }}</p>
            <p class="text-xs">{{ t('products.chooseImageToStart') }}</p>
          </div>
        </div>
      </div>
    </UFormField>
  </fieldset>

  <UModal v-model:open="previewOpen" :title="selectedAsset?.name || t('products.previewImage')">
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
