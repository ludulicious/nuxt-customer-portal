<script setup lang="ts">
import type { Product, ProductPreview } from '../../shared/types'

defineProps<{ product: Product; copy: ProductPreview['content']['en'] }>()
const { t } = useI18n()
const api = useProducts()
</script>

<template>
  <UCard>
    <div class="space-y-6">
      <div v-if="product.imageIds.length" class="grid gap-3 sm:grid-cols-2">
        <img
          v-for="id in product.imageIds"
          :key="id"
          :src="api.previewImageUrl(product.id, id)"
          :alt="copy.title"
          class="w-full rounded-lg object-contain"
          loading="lazy"
        />
      </div>
      <div
        v-else
        class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg bg-elevated/50 p-6 text-muted"
      >
        <UIcon name="i-lucide-image" class="size-8" />
        <p class="text-sm">{{ t('products.noImages') }}</p>
      </div>
      <p v-if="copy.summary" class="text-lg">{{ copy.summary }}</p>
      <!-- The preview endpoint sanitizes Markdown with the catalog HTML allowlist. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="copy.descriptionHtml" class="prose max-w-none dark:prose-invert" v-html="copy.descriptionHtml" />
      <p v-else class="text-muted">{{ t('products.noDescription') }}</p>
      <UButton v-if="product.videoUrl" :to="product.videoUrl" target="_blank" variant="outline" icon="i-lucide-play">{{
        t('products.watchPreview')
      }}</UButton>
    </div>
  </UCard>
</template>
