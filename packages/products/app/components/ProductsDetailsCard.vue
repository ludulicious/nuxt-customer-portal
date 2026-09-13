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
            >{{ action.label }}</UButton
          >
        </div>
      </div>
    </template>
    <slot v-if="editing" name="editor" />
    <div v-else class="space-y-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-link" class="size-4 shrink-0" />{{ t('products.slug') }}
          </p>
          <p class="mt-2 break-all font-mono text-sm font-medium">/{{ product.slug }}</p>
        </div>
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
      <dl class="space-y-4 border-t border-default pt-4 text-sm">
        <div class="flex items-start justify-between gap-4">
          <dt class="flex items-center gap-2 text-muted">
            <UIcon name="i-lucide-folder" class="size-4 shrink-0" />{{ t('products.category') }}
          </dt>
          <dd class="min-w-0 break-words text-right font-medium" :class="!product.categoryId ? 'text-muted' : ''">
            {{ product.categoryContent?.[language]?.name || product.categoryName || t('products.noCategory') }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="flex items-center gap-2 text-muted">
            <UIcon name="i-lucide-package" class="size-4 shrink-0" />{{ t('products.type') }}
          </dt>
          <dd>
            <UBadge color="neutral" variant="subtle">{{ t(`products.${product.type}`) }}</UBadge>
          </dd>
        </div>
      </dl>
      <div class="border-t border-default pt-4">
        <p class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-receipt-text" class="size-4 shrink-0" />{{ t('products.taxCode') }}
        </p>
        <p class="mt-2 break-all font-mono text-xs text-muted">{{ product.taxCode }}</p>
      </div>
    </div>
  </UCard>
  <ProductsPublishDialog
    v-if="publishOpen"
    v-model:open="publishOpen"
    :product-id="product.id"
    @saved="emit('saved')"
  />
</template>
