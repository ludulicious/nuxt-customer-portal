<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  filters: Array<{ key: string; placeholder: string; items: Array<{ label: string; value: string | undefined }> }>
  filterValues: Record<string, string | undefined>
  sortOptions: Array<{ label: string; value: string }>
  sortBy: string
  sortDir: 'asc' | 'desc'
}>()
const search = defineModel<string>('search', { required: true })
</script>

<template>
  <PortalListToolbar
    v-bind="{ ...props, ...$attrs }"
    v-model:search="search"
    :search-placeholder="$t('features.timesheets.admin.list.search')"
  />
</template>
