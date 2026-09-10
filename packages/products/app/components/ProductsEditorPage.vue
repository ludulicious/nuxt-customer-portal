<script setup lang="ts">
import type { Product } from '../../shared/types'

const props = defineProps<{ productId?: string }>()
const { t } = useI18n()
const route = useRoute()
const api = useProducts()
const product = ref<Product>()
const pending = ref(!!props.productId)
const error = ref('')
const back = () => navigateTo({ path: '/admin/products', query: route.query })
watch(
  () => props.productId,
  async (id) => {
    error.value = ''
    product.value = undefined
    pending.value = !!id
    if (!id) {
      return
    }
    try {
      product.value = await api.get(id)
    } catch {
      error.value = t('products.loadFailed')
    } finally {
      pending.value = false
    }
  },
  { immediate: true }
)
async function saved(value: Product) {
  if (!props.productId) {
    await navigateTo({ path: `/admin/products/${value.id}/edit`, query: route.query }, { replace: true })
  } else {
    await back()
  }
}
</script>

<template>
  <ProductsShell :title="t(productId ? 'products.edit' : 'products.new')" :subtitle="t('products.catalogIntro')">
    <template #back>
      <UButton
        :to="{ path: '/admin/products', query: route.query }"
        icon="i-lucide-arrow-left"
        variant="link"
        color="neutral"
        class="mb-2 w-fit px-0"
        >{{ t('products.backToProducts') }}</UButton
      >
    </template>
    <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    <UAlert v-else-if="error" color="error" :title="error" />
    <ProductsForm v-else :key="product?.id || 'new'" :product="product" @saved="saved" @cancel="back" />
  </ProductsShell>
</template>
