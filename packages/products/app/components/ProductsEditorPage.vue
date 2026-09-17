<script setup lang="ts">
import type { Product } from '../../shared/types'

const props = defineProps<{ productId?: string }>()
const { t } = useI18n()
const route = useRoute()
const api = useProducts()
const product = ref<Product>()
const pending = ref(!!props.productId)
const error = ref('')
const backTarget = computed(() => ({
  path: props.productId ? `/admin/products/${props.productId}` : '/admin/products',
  query: route.query
}))
const back = () => navigateTo(backTarget.value)
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
  await navigateTo({ path: `/admin/products/${value.id}`, query: route.query }, { replace: !props.productId })
}
</script>

<template>
  <ProductsShell :title="t(productId ? 'products.edit' : 'products.new')" :subtitle="t('products.catalogIntro')">
    <template #back>
      <UButton :to="backTarget" icon="i-lucide-arrow-left" variant="link" color="neutral" class="mb-2 w-fit px-0">{{
        t(productId ? 'products.backToProduct' : 'products.backToProducts')
      }}</UButton>
    </template>
    <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    <UAlert v-else-if="error" color="error" :title="error" />
    <ProductsForm
      v-else
      :key="product?.id || 'new'"
      :product="product"
      :section="productId ? 'all' : 'create'"
      @saved="saved"
      @cancel="back"
    />
  </ProductsShell>
</template>
