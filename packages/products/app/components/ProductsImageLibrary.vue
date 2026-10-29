<script setup lang="ts">
import { orderedProductImagePlacements } from '../../shared/product-media'
import type { Asset } from '../../shared/types'

const props = defineProps<{ productId: string; assets: Asset[]; busy: boolean }>()
const imageIds = defineModel<string[]>('imageIds', { required: true })
const thumbnailImageId = defineModel<string | null>('thumbnailImageId', { required: true })
const galleryImageIds = defineModel<string[]>('galleryImageIds', { required: true })
const detailImageIds = defineModel<string[]>('detailImageIds', { required: true })
const emit = defineEmits<{ linked: [asset: Asset] }>()
const { t } = useI18n(),
  api = useProducts()
const pickerOpen = ref(false),
  previewOpen = ref(false),
  previewId = ref(''),
  draggedId = ref('')
const asset = (id: string) => props.assets.find((item) => item.id === id)
const preview = (id: string) =>
  asset(id)?.media_id ? `/api/products/media/${asset(id)!.media_id}/content` : api.previewImageUrl(props.productId, id)
const selectedMediaIds = computed(() =>
  imageIds.value.map((id) => asset(id)?.media_id).filter((id): id is string => !!id)
)
function update(ids: string[]) {
  const placements = orderedProductImagePlacements(ids)
  imageIds.value = placements.imageIds
  thumbnailImageId.value = placements.thumbnailImageId
  galleryImageIds.value = placements.galleryImageIds
  detailImageIds.value = placements.detailImageIds
}
function linked(value: Asset) {
  if (!value.media_id || !selectedMediaIds.value.includes(value.media_id)) {
    emit('linked', value)
    update([...imageIds.value, value.id])
  }
  pickerOpen.value = false
}
function move(id: string, delta: number) {
  if (props.busy) {
    return
  }
  const ids = [...imageIds.value],
    index = ids.indexOf(id),
    target = index + delta
  if (index < 0 || target < 0 || target >= ids.length) {
    return
  }
  ids.splice(index, 1)
  ids.splice(target, 0, id)
  update(ids)
}
function drop(id: string) {
  if (!draggedId.value || draggedId.value === id || props.busy) {
    return
  }
  const ids = [...imageIds.value],
    from = ids.indexOf(draggedId.value),
    to = ids.indexOf(id)
  if (from < 0 || to < 0) {
    return
  }
  ids.splice(from, 1)
  ids.splice(to, 0, draggedId.value)
  update(ids)
  draggedId.value = ''
}
function showPreview(id: string) {
  previewId.value = id
  previewOpen.value = true
}
function drag(event: DragEvent, id: string) {
  if (props.busy) {
    return
  }
  draggedId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}
</script>

<template>
  <fieldset class="space-y-4">
    <legend class="sr-only">{{ t('products.productImageLibrary') }}</legend>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-xl text-sm text-muted">{{ t('products.productImageLibraryHelp') }}</p>
      <UButton type="button" icon="i-lucide-library" :disabled="busy" @click="pickerOpen = true">{{
        t('products.productMedia.choose')
      }}</UButton>
    </div>
    <UFormField name="imageIds" class="w-full">
      <ol v-if="imageIds.length" class="w-full space-y-3" :aria-label="t('products.productMedia.selectedImages')">
        <li
          v-for="(id, index) in imageIds"
          :key="id"
          :data-product-image-id="id"
          :draggable="!busy"
          class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-default p-3 sm:flex-nowrap"
          :class="draggedId === id ? 'opacity-50' : ''"
          @dragstart="drag($event, id)"
          @dragend="draggedId = ''"
          @dragover.prevent
          @drop.prevent="drop(id)"
        >
          <button
            type="button"
            class="cursor-grab text-muted focus-visible:outline-2 focus-visible:outline-primary"
            :disabled="busy"
            :aria-label="t('products.productMedia.reorder', { number: index + 1 })"
            aria-keyshortcuts="ArrowUp ArrowDown"
            @keydown.up.prevent="move(id, -1)"
            @keydown.down.prevent="move(id, 1)"
          >
            <UIcon name="i-lucide-grip-vertical" class="size-5" />
          </button>
          <button
            type="button"
            class="h-20 w-24 shrink-0 overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-primary"
            :aria-label="t('products.productMedia.preview', { title: asset(id)?.name || '' })"
            @click="showPreview(id)"
          >
            <ProductsMediaImage
              :src="preview(id)"
              :alt="asset(id)?.alternative_text || asset(id)?.name || ''"
              contain
            />
          </button>
          <div class="min-w-0 flex-1 basis-32">
            <p class="truncate text-sm font-medium">
              {{ asset(id)?.name || t('products.imageNumber', { number: index + 1 }) }}
            </p>
            <UBadge v-if="index === 0" class="mt-1" variant="subtle">{{ t('products.imagePurposethumbnail') }}</UBadge>
            <span v-else class="mt-1 block text-xs text-muted">{{ index + 1 }}</span>
          </div>
          <div class="ml-auto flex items-center gap-1">
            <UButton
              type="button"
              icon="i-lucide-arrow-up"
              color="neutral"
              variant="ghost"
              :disabled="busy || index === 0"
              :aria-label="t('products.productMedia.earlier', { number: index + 1 })"
              @click="move(id, -1)"
            />
            <UButton
              type="button"
              icon="i-lucide-arrow-down"
              color="neutral"
              variant="ghost"
              :disabled="busy || index === imageIds.length - 1"
              :aria-label="t('products.productMedia.later', { number: index + 1 })"
              @click="move(id, 1)"
            />
            <UButton
              type="button"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              :disabled="busy"
              :aria-label="t('products.productMedia.remove', { number: index + 1 })"
              @click="update(imageIds.filter((value) => value !== id))"
            />
          </div>
        </li>
      </ol>
      <div v-else class="rounded-lg border border-dashed border-default p-8 text-center text-muted">
        {{ t('products.noProductImages') }}
      </div>
    </UFormField>
    <p v-if="imageIds.length" class="text-xs text-muted">{{ t('products.removeImageHelp') }}</p>
  </fieldset>
  <UModal
    v-if="pickerOpen"
    v-model:open="pickerOpen"
    :title="t('products.productMedia.choose')"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body
      ><ProductsMediaPicker
        :product-id="productId"
        :excluded-media-ids="selectedMediaIds"
        @selected="linked"
        @cancel="pickerOpen = false"
    /></template>
  </UModal>
  <UModal v-if="previewOpen" v-model:open="previewOpen" :title="asset(previewId)?.name || t('products.previewImage')">
    <template #body
      ><div class="h-[65vh] w-full">
        <ProductsMediaImage
          :src="preview(previewId)"
          :alt="asset(previewId)?.alternative_text || asset(previewId)?.name || ''"
          contain
        /></div
    ></template>
  </UModal>
</template>
