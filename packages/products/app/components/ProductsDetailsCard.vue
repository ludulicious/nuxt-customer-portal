<script setup lang="ts">
import type { Product, Locale } from '../../shared/types'
import { productSchema } from '../../shared/validation'

const props = defineProps<{ product: Product; language: Locale; editing: boolean }>()
const emit = defineEmits<{ edit: []; saved: [] }>()
const { t } = useI18n()
const api = useProducts()
const toast = useToast()
const busy = ref(false)
const publishOpen = ref(false)
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
  if (busy.value) {
    return
  }
  const input = { ...props.product, status: action.value.next }
  const parsed = productSchema.safeParse(input)
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
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('products.basicDetails') }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="product.status === 'published' ? 'success' : 'neutral'" variant="subtle">{{
            t(`products.${product.status}`)
          }}</UBadge>
          <UButton
            :icon="action.icon"
            :color="action.next === 'published' ? 'success' : 'primary'"
            variant="outline"
            :loading="busy"
            :disabled="busy || editing"
            @click="changeStatus"
          >{{ action.label }}</UButton>
        </div>
      </div>
    </template>
    <slot v-if="editing" name="editor" />
    <div v-else class="flex items-start gap-3">
      <dl class="min-w-0 flex-1 space-y-4 text-sm">
        <div>
          <dt class="text-muted">{{ t('products.slug') }}</dt>
          <dd class="mt-1 break-words">{{ product.slug }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('products.category') }}</dt>
          <dd class="mt-1 break-words">
            {{ product.categoryContent?.[language]?.name || product.categoryName || t('products.noCategory') }}
          </dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('products.type') }}</dt>
          <dd class="mt-1">{{ t(`products.${product.type}`) }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('products.taxCode') }}</dt>
          <dd class="mt-1 break-all">{{ product.taxCode }}</dd>
        </div>
      </dl>
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        class="shrink-0"
        :aria-label="t('products.edit')"
        :aria-expanded="editing"
        :disabled="busy"
        @click="emit('edit')"
      />
    </div>
  </UCard>
  <ProductsPublishDialog v-model:open="publishOpen" :product-id="product.id" @saved="emit('saved')" />
</template>
