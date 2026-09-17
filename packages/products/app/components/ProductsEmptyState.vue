<script setup lang="ts">
defineProps<{ filtered: boolean; title?: string; description?: string; actionLabel?: string; icon?: string }>()
const emit = defineEmits<{ create: []; reset: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard variant="subtle">
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <UIcon :name="icon || (filtered ? 'i-lucide-search' : 'i-lucide-shopping-bag')" class="size-10 text-muted" />
      <div>
        <h2 class="font-semibold">{{ title || t(filtered ? 'products.noResults' : 'products.empty') }}</h2>
        <p class="text-sm text-muted">
          {{ description || t(filtered ? 'products.noResultsHelp' : 'products.emptyHelp') }}
        </p>
      </div>
      <UButton v-if="filtered" variant="outline" color="neutral" @click="emit('reset')">{{
        t('products.clearFilters')
      }}</UButton>
      <UButton v-else icon="i-lucide-plus" @click="emit('create')">{{
        actionLabel || t('products.createFirst')
      }}</UButton>
    </div>
  </UCard>
</template>
