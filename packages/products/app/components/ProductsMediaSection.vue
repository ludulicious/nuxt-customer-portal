<script setup lang="ts">
import type { Product } from '../../shared/types'

defineProps<{ product: Product; editing: boolean }>()
const emit = defineEmits<{ edit: []; saved: []; cancel: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard>
    <template #header
      ><div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('products.mediaAndFiles') }}</h2>
        <UButton icon="i-lucide-pencil" variant="outline" :aria-expanded="editing" @click="emit('edit')">{{
          t('products.manageMedia')
        }}</UButton>
      </div></template
    >
    <ProductsForm
      v-if="editing"
      :key="`media-${product.updatedAt}`"
      :product="product"
      section="media"
      @saved="emit('saved')"
      @cancel="emit('cancel')"
    />
    <div v-else class="space-y-2 text-sm text-muted">
      <p>{{ t('products.images') }}: {{ product.imageIds.length }}</p>
      <p>{{ t('products.files') }}: {{ product.fileIds.length }}</p>
      <p v-if="product.videoUrl">{{ product.videoUrl }}</p>
    </div>
  </UCard>
</template>
