<script setup lang="ts">
type Option = { label: string, value: string | undefined, badgeText?: string, badgeColor?: string }
const props = defineProps<{
  filters: Array<{ key: string, placeholder: string, items: Option[] }>
  filterValues: Record<string, string | undefined>
  sortOptions: Array<{ label: string, value: string }>
  sortBy: string
  sortDir: 'asc' | 'desc'
}>()
const emit = defineEmits<{ filter: [key: string, value: string | undefined], sort: [value: string], toggleDirection: [] }>()
const search = defineModel<string>('search', { required: true })
const { t } = useI18n()
const showFilters = ref(false)
const showSort = ref(false)
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')
const selectedSort = computed(() => props.sortOptions.find(option => option.value === props.sortBy)?.label ?? '')
</script>

<template>
  <div class="border-y border-default py-2">
    <div class="flex items-center gap-2">
      <UInput v-model="search" :placeholder="t('features.timesheets.admin.list.search')" icon="i-lucide-search" class="min-w-0 flex-1 md:max-w-xs" />
      <template v-if="!isMobile">
        <USelect v-for="filter in filters" :key="filter.key" :model-value="filterValues[filter.key]" :items="filter.items" value-key="value" :placeholder="filter.placeholder" class="w-44" @update:model-value="emit('filter', filter.key, $event)" />
        <UDropdownMenu :items="[sortOptions.map(option => ({ label: option.label, icon: sortBy === option.value ? 'i-lucide-check' : undefined, onSelect: () => emit('sort', option.value) }))]" :content="{ align: 'end' }">
          <UButton variant="outline" icon="i-lucide-arrow-down-up" class="ml-auto w-44 justify-between"><span class="truncate">{{ selectedSort }}</span><UIcon name="i-lucide-chevron-down" class="size-4 opacity-60" /></UButton>
        </UDropdownMenu>
        <UButton variant="outline" :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'" :aria-label="t('features.timesheets.admin.list.direction')" @click="emit('toggleDirection')" />
      </template>
      <template v-else>
        <UButton variant="outline" icon="i-lucide-filter" :aria-label="t('features.timesheets.admin.list.filters')" @click="showFilters = true" />
        <UButton variant="outline" icon="i-lucide-arrow-down-up" :aria-label="t('features.timesheets.admin.list.sort')" @click="showSort = true" />
      </template>
    </div>
    <UModal v-model:open="showFilters" :title="t('features.timesheets.admin.list.filters')"><template #body><div class="space-y-4"><UFormField v-for="filter in filters" :key="filter.key" :label="filter.placeholder"><USelect :model-value="filterValues[filter.key]" :items="filter.items" value-key="value" class="w-full" @update:model-value="emit('filter', filter.key, $event)" /></UFormField></div></template></UModal>
    <UModal v-model:open="showSort" :title="t('features.timesheets.admin.list.sort')"><template #body><div class="space-y-4"><USelect :model-value="sortBy" :items="sortOptions" value-key="value" class="w-full" @update:model-value="emit('sort', $event)" /><UButton block variant="outline" :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'" @click="emit('toggleDirection')">{{ t('features.timesheets.admin.list.direction') }}</UButton></div></template></UModal>
  </div>
</template>
