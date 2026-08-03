<script setup lang="ts">
import type { TimesheetsListPagination } from '#layers/timesheets/shared/types/timesheet'

const props = defineProps<{ pagination: TimesheetsListPagination, pending: boolean, loadingNext: boolean, loadingPrevious: boolean, hasNext: boolean, hasPrevious: boolean }>()
const emit = defineEmits<{ next: [], previous: [], page: [page: number] }>()
const scrollContainer = ref<HTMLElement | null>(null)
const previousSentinel = ref<HTMLElement | null>(null)
const nextSentinel = ref<HTMLElement | null>(null)
let previousScrollHeight = 0
const loadPrevious = () => {
  previousScrollHeight = scrollContainer.value?.scrollHeight ?? 0
  emit('previous')
}
watch(() => props.loadingPrevious, async (loading, wasLoading) => {
  if (loading || !wasLoading || !scrollContainer.value) return
  await nextTick()
  scrollContainer.value.scrollTop += scrollContainer.value.scrollHeight - previousScrollHeight
})
useAutoPagination({ sentinel: previousSentinel, scrollContainer, canLoadMore: () => props.hasPrevious, loading: () => props.pending, loadMore: loadPrevious, rootMargin: '240px 0px 0px 0px' })
useAutoPagination({ sentinel: nextSentinel, scrollContainer, canLoadMore: () => props.hasNext, loading: () => props.pending, loadMore: () => emit('next') })
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div ref="scrollContainer" class="timesheets-list-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div v-if="hasPrevious" ref="previousSentinel" class="h-px" aria-hidden="true" />
      <div v-if="loadingPrevious" class="space-y-2 pb-3"><USkeleton v-for="index in 2" :key="index" class="h-24 w-full" /></div>
      <slot />
      <div v-if="hasNext" ref="nextSentinel" class="h-px" aria-hidden="true" />
      <div v-if="loadingNext" class="space-y-2 pt-3"><USkeleton v-for="index in 2" :key="index" class="h-24 w-full" /></div>
    </div>
    <footer class="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-default px-1 pt-3 text-sm text-muted">
      <span>{{ $t('features.timesheets.admin.list.totalRecords', { count: pagination.total }) }}</span>
      <UPagination v-if="pagination.pageCount > 1" :page="pagination.page" :total="pagination.total" :items-per-page="pagination.pageSize" :disabled="pending" @update:page="emit('page', $event)" />
    </footer>
  </div>
</template>

<style scoped>
.timesheets-list-scroll {
  padding: 2px 8px 16px 2px;
}
</style>
