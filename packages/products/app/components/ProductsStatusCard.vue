<script setup lang="ts">
import type { Product } from '../../shared/types'
import { productSchema } from '../../shared/validation'

const props = defineProps<{ product: Product; disabled?: boolean }>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const api = useProducts()
const toast = useToast()
const busy = ref(false)
const publishOpen = ref(false)
const statusConfirmOpen = ref(false)
const action = computed(
  () =>
    ({
      draft: { next: 'published' as const, label: t('products.publish'), icon: 'i-lucide-globe' },
      published: { next: 'archived' as const, label: t('products.archive'), icon: 'i-lucide-archive' },
      archived: { next: 'draft' as const, label: t('products.restoreDraft'), icon: 'i-lucide-archive-restore' }
    })[props.product.status]
)
async function changeStatus() {
  if (action.value.next === 'published') {
    publishOpen.value = true
    return
  }
  statusConfirmOpen.value = true
}
async function confirmStatusChange() {
  if (busy.value) return
  const parsed = productSchema.safeParse({ ...props.product, status: action.value.next })
  if (!parsed.success) {
    toast.add({ title: t('products.statusRequirements'), color: 'error' })
    return
  }
  busy.value = true
  try {
    await api.save(parsed.data, props.product.id)
    emit('saved')
  } catch {
    toast.add({ title: t('products.saveFailed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-sm font-medium">{{ t('products.productStatus') }}</h3>
      <UBadge :color="product.status === 'published' ? 'success' : 'neutral'" variant="subtle">
        {{ t(`products.${product.status}`) }}
      </UBadge>
    </div>
    <p class="text-sm text-muted">{{ t(`products.${product.status}StatusHelp`) }}</p>
    <UButton
      block
      :icon="action.icon"
      :color="action.next === 'published' ? 'success' : 'primary'"
      variant="outline"
      :loading="busy"
      :disabled="busy || disabled"
      @click="changeStatus"
    >
      {{ action.label }}
    </UButton>
  </div>
  <ProductsPublishDialog
    v-if="publishOpen"
    v-model:open="publishOpen"
    :product-id="product.id"
    @saved="emit('saved')"
  />
  <ConfirmationModal
    v-if="statusConfirmOpen"
    v-model:open="statusConfirmOpen"
    :title="`products.${action.next}ConfirmTitle`"
    :message="`products.${action.next}Confirm`"
    :message-params="{ name: product.content.en.title || product.content.nl.title || product.slug }"
    :confirm-text="`products.${action.next === 'archived' ? 'archive' : 'restoreDraft'}`"
    :confirm-color="action.next === 'archived' ? 'warning' : 'primary'"
    @confirm="confirmStatusChange"
  />
</template>
