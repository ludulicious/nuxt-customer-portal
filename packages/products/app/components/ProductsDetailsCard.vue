<script setup lang="ts">
import type { Product, Locale } from '../../shared/types'

defineProps<{ product: Product; language: Locale; editing: boolean }>()
defineEmits<{ edit: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('products.basicDetails') }}</h2>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="soft"
          size="sm"
          :aria-label="t('products.editProduct')"
          :aria-expanded="editing"
          @click="$emit('edit')"
        />
      </div>
    </template>
    <slot v-if="editing" name="editor" />
    <div v-else class="space-y-5">
      <div class="min-w-0">
        <p class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-link" class="size-4 shrink-0" />{{ t('products.slug') }}
        </p>
        <p class="mt-2 break-all font-mono text-sm font-medium">/{{ product.slug }}</p>
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
      <div class="border-t border-default pt-4">
        <slot name="status" />
      </div>
    </div>
  </UCard>
</template>
