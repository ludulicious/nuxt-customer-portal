<script setup lang="ts">
import type { Product } from '../../shared/types'

defineProps<{ product: Product }>()
defineEmits<{ deleted: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard class="ring-error/20">
    <template #header
      ><h2 class="font-semibold text-error">{{ t('products.dangerZone') }}</h2></template
    >
    <div class="space-y-4">
      <p class="text-sm text-muted">{{ t('products.deleteProductHelp') }}</p>
      <ProductsDelete :product="product" @deleted="$emit('deleted')" />
    </div>
  </UCard>
</template>
