<script setup lang="ts">
import type { ProductPreview } from '../../../../../shared/types'

definePageMeta({ key: (route) => route.path })
const { t } = useI18n()
const route = useRoute()
const api = useProducts()
const toast = useToast()
const preview = ref<ProductPreview>()
const pending = ref(true)
const error = ref('')
const dirty = ref(false)
const unsavedOpen = ref(false)
const saveRequest = ref(0)
const product = computed(() => preview.value?.product)
const productName = computed(() => {
  const content = product.value?.content
  return (
    content?.[preview.value?.defaultLocale || 'en'].title.trim() ||
    content?.en.title.trim() ||
    content?.nl.title.trim() ||
    product.value?.slug ||
    t('products.loading')
  )
})
const productTarget = computed(() => ({ path: `/admin/products/${route.params.id}`, query: route.query }))

function requestClose() {
  if (dirty.value) {
    unsavedOpen.value = true
    return
  }
  return navigateTo(productTarget.value)
}
function discard() {
  unsavedOpen.value = false
  dirty.value = false
  return navigateTo(productTarget.value)
}
function saveAndClose() {
  unsavedOpen.value = false
  saveRequest.value += 1
}
async function saved() {
  toast.add({ title: t('products.saved'), color: 'success' })
  await navigateTo(productTarget.value)
}

try {
  preview.value = await api.preview(String(route.params.id))
} catch {
  error.value = t('products.loadFailed')
} finally {
  pending.value = false
}
</script>

<template>
  <ProductsShell :title="productName" :subtitle="t('products.productImageLibraryHelp')">
    <template #back>
      <UButton variant="link" color="neutral" icon="i-lucide-arrow-left" class="w-fit px-0" @click="requestClose">
        {{ t('products.backToProduct') }}
      </UButton>
    </template>
    <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    <UAlert v-else-if="error" color="error" :title="error" />
    <UCard v-else-if="product">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-semibold">{{ t('products.productImageLibrary') }}</h2>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="t('products.close')"
            @click="requestClose"
          />
        </div>
      </template>
      <ProductsForm
        :key="`images-${product.updatedAt}`"
        :product="product"
        :save-request="saveRequest"
        section="images"
        @saved="saved"
        @cancel="requestClose"
        @dirty="dirty = $event"
      />
    </UCard>
    <UModal
      v-if="unsavedOpen"
      v-model:open="unsavedOpen"
      :title="t('products.unsavedImageChanges')"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <p class="text-sm text-muted">{{ t('products.unsavedImageChangesHelp') }}</p>
      </template>
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="unsavedOpen = false">
          {{ t('products.keepEditing') }}
        </UButton>
        <UButton color="neutral" variant="outline" @click="discard">
          {{ t('products.discardChanges') }}
        </UButton>
        <UButton icon="i-lucide-save" @click="saveAndClose">
          {{ t('products.saveChanges') }}
        </UButton>
      </template>
    </UModal>
  </ProductsShell>
</template>
