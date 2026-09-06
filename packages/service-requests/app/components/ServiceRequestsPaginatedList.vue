<script setup lang="ts">
import type { ServiceRequestPagination } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const props = defineProps<{
  pagination: ServiceRequestPagination
  pending: boolean
  loadingNext: boolean
  loadingPrevious: boolean
  hasNext: boolean
  hasPrevious: boolean
  initialScrollTop?: number
  error?: boolean
}>()
const emit = defineEmits<{ next: []; previous: []; page: [page: number]; scroll: [scrollTop: number] }>()
const scrollContainer = ref<HTMLElement | null>(null)
const nextSentinel = ref<HTMLElement | null>(null)
let previousScrollHeight = 0
let lastScrollTop = 0
const goToPage = (page: number) => {
  lastScrollTop = 0
  scrollContainer.value?.scrollTo({ top: 0 })
  emit('page', page)
}
const loadPrevious = () => {
  previousScrollHeight = scrollContainer.value?.scrollHeight ?? 0
  emit('previous')
}
watch(
  () => props.loadingPrevious,
  async (loading, wasLoading) => {
    if (loading || !wasLoading || !scrollContainer.value) {
      return
    }
    await nextTick()
    scrollContainer.value.scrollTop += scrollContainer.value.scrollHeight - previousScrollHeight
  }
)
// Only prepend after an upward scroll. A numbered jump to page 2 must stay on page 2.
const onScroll = () => {
  const top = scrollContainer.value?.scrollTop ?? 0
  if (top < lastScrollTop && top < 240 && props.hasPrevious && !props.pending && !props.error) {
    loadPrevious()
  }
  lastScrollTop = top
  emit('scroll', top)
}
useAutoPagination({
  sentinel: nextSentinel,
  scrollContainer,
  canLoadMore: () => props.hasNext && !props.error,
  loading: () => props.pending,
  loadMore: () => emit('next')
})
onMounted(async () => {
  if (!props.initialScrollTop) {
    return
  }
  await nextTick()
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = props.initialScrollTop
  }
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      ref="scrollContainer"
      class="service-request-list-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      @scroll="onScroll"
    >
      <UButton
        v-if="hasPrevious && !loadingPrevious"
        color="neutral"
        variant="ghost"
        class="mb-3"
        :disabled="pending"
        @click="loadPrevious"
        >{{ $t('features.serviceRequests.list.loadPrevious') }}</UButton
      >
      <div v-if="loadingPrevious" class="space-y-2 pb-3">
        <USkeleton v-for="index in 2" :key="index" class="h-24 w-full" />
      </div>
      <div v-if="pending && !loadingNext && !loadingPrevious" class="space-y-3" aria-busy="true">
        <USkeleton v-for="index in 4" :key="index" class="h-28 w-full" />
      </div>
      <div v-else><slot /></div>
      <div v-if="hasNext" ref="nextSentinel" class="h-px" aria-hidden="true" />
      <div v-if="loadingNext" class="space-y-2 pt-3">
        <USkeleton v-for="index in 2" :key="index" class="h-24 w-full" />
      </div>
    </div>
    <footer
      class="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-default px-1 pt-3 text-sm text-muted"
    >
      <span>{{ $t('features.serviceRequests.resultCount', { count: pagination.total }, pagination.total) }}</span>
      <UPagination
        v-if="pagination.pageCount > 1"
        :page="pagination.page"
        :total="pagination.total"
        :items-per-page="pagination.pageSize"
        :disabled="pending"
        :sibling-count="1"
        :show-edges="false"
        @update:page="goToPage($event)"
      />
    </footer>
  </div>
</template>

<style scoped>
.service-request-list-scroll {
  padding: 2px 2px 16px;
}
</style>
