<script setup lang="ts">
import type { Price, Locale } from '../../shared/types'
import { formatMoney } from '../../shared/money'

defineProps<{ price?: Price; language: Locale; editing: boolean }>()
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard>
    <template #header
      ><div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('products.prices') }}</h2>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          :aria-label="t('products.editPrices')"
          :aria-expanded="editing"
          @click="emit('edit')"
        /></div
    ></template>
    <div class="divide-y divide-default">
      <div v-if="price" class="space-y-1">
        <p class="text-2xl font-semibold">
          {{ price.amount === 0 ? t('products.freeProduct') : formatMoney(price.amount, price.currency, language) }}
          <span v-if="price.amount > 0" class="text-sm font-normal text-muted">{{ price.currency }}</span>
        </p>
        <p v-if="price.amount > 0" class="text-sm text-muted">{{ t(`products.${price.taxBehavior}`) }}</p>
      </div>
    </div>
  </UCard>
</template>
