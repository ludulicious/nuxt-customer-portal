<script setup lang="ts">
type Option = { label: string; value: string | undefined; badgeText?: string; badgeColor?: string }
const props = defineProps<{
  searchPlaceholder?: string
  filters: Array<{ key: string; placeholder: string; items: Option[] }>
  filterValues: Record<string, string | undefined>
  sortOptions: Array<{ label: string; value: string }>
  sortBy: string
  sortDir: 'asc' | 'desc'
}>()
const emit = defineEmits<{
  filter: [key: string, value: string | undefined]
  sort: [value: string]
  toggleDirection: []
}>()
const search = defineModel<string>('search', { required: true })
const { t } = useI18n()
const showFilters = ref(false)
const showSort = ref(false)
const toolbar = ref<HTMLElement | null>(null)
const { width } = useElementSize(toolbar)
const isMobile = computed(() => width.value < Math.max(660, 160 + props.filters.length * 120 + 232))
</script>

<template>
  <div ref="toolbar" class="shrink-0 border-b border-default pb-4">
    <div class="flex items-center gap-2">
      <UInput
        v-model="search"
        :placeholder="searchPlaceholder || t('common.searchPlaceholder')"
        icon="i-lucide-search"
        :class="isMobile ? 'min-w-0 flex-1' : 'min-w-40 flex-1 md:max-w-xs'"
      />
      <template v-if="!isMobile">
        <USelect
          v-for="filter in filters"
          :key="filter.key"
          :model-value="filterValues[filter.key]"
          :items="filter.items"
          value-key="value"
          :placeholder="filter.placeholder"
          :aria-label="filter.placeholder"
          class="w-44 min-w-28 shrink"
          @update:model-value="emit('filter', filter.key, $event)"
        />
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <USelect
            :model-value="sortBy"
            :items="sortOptions"
            value-key="value"
            icon="i-lucide-arrow-down-up"
            :aria-label="t('common.sortBy')"
            class="w-44"
            @update:model-value="emit('sort', $event)"
          />
          <UButton
            color="neutral"
            variant="outline"
            :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'"
            :aria-label="t('common.direction')"
            @click="emit('toggleDirection')"
          />
        </div>
      </template>
      <template v-else>
        <UButton
          v-if="filters.length"
          color="neutral"
          variant="outline"
          icon="i-lucide-filter"
          :aria-label="t('common.filters')"
          @click="showFilters = true"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-down-up"
          :aria-label="t('common.sort')"
          @click="showSort = true"
        />
      </template>
    </div>
    <UModal v-model:open="showFilters" :title="t('common.filters')">
      <template #body>
        <div class="space-y-4">
          <UFormField v-for="filter in filters" :key="filter.key" :label="filter.placeholder">
            <USelect
              :model-value="filterValues[filter.key]"
              :items="filter.items"
              value-key="value"
              class="w-full"
              @update:model-value="emit('filter', filter.key, $event)"
            />
          </UFormField>
        </div>
      </template>
    </UModal>
    <UModal v-model:open="showSort" :title="t('common.sort')">
      <template #body>
        <div class="space-y-4">
          <USelect
            :model-value="sortBy"
            :items="sortOptions"
            icon="i-lucide-arrow-down-up"
            :aria-label="t('common.sortBy')"
            value-key="value"
            class="w-full"
            @update:model-value="emit('sort', $event)"
          /><UButton
            block
            color="neutral"
            variant="outline"
            :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'"
            @click="emit('toggleDirection')"
          >
            {{ t('common.direction') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
