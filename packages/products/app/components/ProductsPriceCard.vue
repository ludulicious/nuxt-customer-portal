<script setup lang="ts">
import type { Price, Locale } from '../../shared/types'
import { formatMoney } from '../../shared/money'

defineProps<{ price?: Price; isFree: boolean; language: Locale; editing: boolean; currencies: string[] }>()
const currency = defineModel<string>('currency', { required: true })
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard>
    <template #header
      ><div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('products.prices') }}</h2>
        <div class="flex items-center gap-2">
          <USelect
            v-if="currencies.length > 1"
            v-model="currency"
            :items="currencies"
            :disabled="editing"
            size="sm"
            :aria-label="t('products.currency')"
            class="w-24"
          />
        </div></div
    ></template>
    <slot v-if="editing" name="editor" />
    <div v-else class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <p class="text-2xl font-semibold">
          {{ isFree ? t('products.freeProduct') : formatMoney(price?.amount ?? 0, currency, language) }}
          <span v-if="!isFree" class="text-sm font-normal text-muted">{{ currency }}</span>
        </p>
        <p v-if="!isFree && price" class="text-sm text-muted">{{ t(`products.${price.taxBehavior}`) }}</p>
      </div>
      <UButton
        v-if="!isFree"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        class="shrink-0"
        :aria-label="t('products.editPrices')"
        :aria-expanded="editing"
        @click="emit('edit')"
      />
    </div>
  </UCard>
</template>
