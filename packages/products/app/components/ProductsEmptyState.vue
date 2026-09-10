<script setup lang="ts">
defineProps<{ filtered: boolean }>()
const emit = defineEmits<{ create: []; reset: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard variant="subtle">
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <UIcon :name="filtered ? 'i-lucide-search' : 'i-lucide-shopping-bag'" class="size-10 text-muted" />
      <div>
        <h2 class="font-semibold">{{ t(filtered ? 'products.noResults' : 'products.empty') }}</h2>
        <p class="text-sm text-muted">{{ t(filtered ? 'products.noResultsHelp' : 'products.emptyHelp') }}</p>
      </div>
      <UButton v-if="filtered" variant="outline" color="neutral" @click="emit('reset')">{{
        t('products.clearFilters')
      }}</UButton>
      <UButton v-else icon="i-lucide-plus" @click="emit('create')">{{ t('products.createFirst') }}</UButton>
    </div>
  </UCard>
</template>
