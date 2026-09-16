<script setup lang="ts">
import { usePaginatedResource } from '@nuxt-customer-portal/core/app/composables/usePaginatedResource'
import type { PlanningJobListItem } from '../composables/usePlanning'

const api = usePlanning()
const { t, locale } = useI18n()
const route = useRoute()
const kinds = ref<string[]>([])
const error = ref('')
const retryingAll = ref(false)
const retryingId = ref('')
const list = ref<HTMLElement | null>(null)
const previousSentinel = ref<HTMLElement | null>(null)
const nextSentinel = ref<HTMLElement | null>(null)
const searchDraft = ref(typeof route.query.syncSearch === 'string' ? route.query.syncSearch : '')
let searchTimer: ReturnType<typeof setTimeout> | undefined
let previousScrollHeight = 0

const filters = computed(() => ({
  search: typeof route.query.syncSearch === 'string' ? route.query.syncSearch : '',
  status: ['all', 'failed', 'queued', 'succeeded'].includes(String(route.query.syncStatus))
    ? String(route.query.syncStatus)
    : 'failed',
  kind: typeof route.query.syncKind === 'string' ? route.query.syncKind : 'all',
  sort: ['attempts', 'kind'].includes(String(route.query.syncSort)) ? String(route.query.syncSort) : 'lastEvent',
  direction: route.query.syncDirection === 'asc' ? 'asc' : 'desc',
  page: Math.max(1, Number(route.query.syncPage) || 1)
}))

async function update(changes: Partial<Omit<typeof filters.value, 'page'>>, page = 1) {
  const next = { ...filters.value, ...changes, page }
  await navigateTo(
    {
      query: {
        ...route.query,
        syncSearch: next.search || undefined,
        syncStatus: next.status === 'failed' ? undefined : next.status,
        syncKind: next.kind === 'all' ? undefined : next.kind,
        syncSort: next.sort === 'lastEvent' ? undefined : next.sort,
        syncDirection: next.direction === 'desc' ? undefined : next.direction,
        syncPage: next.page === 1 ? undefined : String(next.page)
      }
    },
    { replace: true }
  )
}

function updateSearch(value: string | number) {
  searchDraft.value = String(value)
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void update({ search: searchDraft.value }), 250)
}

function updateFilter(key: string, value: string | undefined) {
  if (key === 'status') void update({ status: value || 'all' })
  if (key === 'kind') void update({ kind: value || 'all' })
}

const query = computed(() => ({
  search: filters.value.search,
  status: filters.value.status,
  kind: filters.value.kind,
  sort: filters.value.sort,
  direction: filters.value.direction
}))
const resource = usePaginatedResource<PlanningJobListItem, typeof query.value>({
  pageSize: 20,
  getKey: (job) => job.id,
  fetchPage: async ({ filters: requestFilters, page, pageSize, signal }) => {
    const result = await api.jobs({ ...requestFilters, page, pageSize }, signal)
    kinds.value = result.kinds
    return result
  }
})
const jobs = resource.items
const pagination = resource.pagination
const pending = resource.pending

async function loadPage(page = filters.value.page) {
  error.value = ''
  try {
    await resource.loadPage(query.value, { page })
  } catch {
    error.value = t('planning.loadError')
  }
}

watch(
  () => JSON.stringify(query.value),
  () => void loadPage(filters.value.page),
  { immediate: true }
)
watch(
  () => filters.value.page,
  (page) => {
    if (page >= resource.firstLoadedPage.value && page <= resource.lastLoadedPage.value) return
    void loadPage(page)
  }
)
watch(
  () => filters.value.search,
  (value) => (searchDraft.value = value)
)
onBeforeUnmount(() => clearTimeout(searchTimer))

async function retryAll() {
  retryingAll.value = true
  error.value = ''
  try {
    await api.retry()
    await loadPage()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    retryingAll.value = false
  }
}

async function retryJob(id: string) {
  retryingId.value = id
  error.value = ''
  try {
    await api.retryJob(id)
    await loadPage()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    retryingId.value = ''
  }
}

const dateTime = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const kindLabel = (kind: string) => t(`planning.jobKinds.${kind}`, kind)
const productSummary = (job: PlanningJobListItem) =>
  job.entity?.allProducts
    ? t('planning.jobAllProducts')
    : job.entity?.productTitles.join(', ') || t('planning.noProducts')

async function loadNext() {
  const result = await resource.loadNextPage(query.value)
  if (result) await update({}, result.pagination.page)
}

async function loadPrevious() {
  previousScrollHeight = list.value?.scrollHeight ?? 0
  const result = await resource.loadPreviousPage(query.value)
  if (!result) return
  await nextTick()
  if (list.value) list.value.scrollTop += list.value.scrollHeight - previousScrollHeight
  await update({}, result.pagination.page)
}

useAutoPagination({
  sentinel: previousSentinel,
  scrollContainer: list,
  canLoadMore: resource.hasPreviousPage,
  loading: resource.pending,
  loadMore: loadPrevious,
  rootMargin: '240px 0px 0px 0px'
})
useAutoPagination({
  sentinel: nextSentinel,
  scrollContainer: list,
  canLoadMore: resource.hasNextPage,
  loading: resource.pending,
  loadMore: loadNext
})
</script>

<template>
  <section class="flex h-[calc(100dvh-250px)] min-h-[460px] flex-col overflow-hidden rounded-xl border border-default">
    <header class="shrink-0 bg-default">
      <div class="flex flex-wrap items-start justify-between gap-3 p-4">
        <div class="flex items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-refresh-cw" class="size-5" />
          </span>
          <div>
            <h2 class="font-semibold text-highlighted">{{ t('planning.pendingTasks') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('planning.pendingTasksDescription') }}</p>
          </div>
        </div>
        <UButton v-if="pagination.total && filters.status === 'failed'" icon="i-lucide-refresh-cw" variant="outline" :loading="retryingAll" @click="retryAll">
          {{ t('planning.retryAll') }}
        </UButton>
      </div>
      <PortalListToolbar
        :search="searchDraft"
        :search-placeholder="t('planning.searchSynchronization')"
        :filters="[
          {
            key: 'status',
            placeholder: t('planning.status'),
            items: [
              { value: 'all', label: t('planning.allSyncStatuses') },
              { value: 'failed', label: t('planning.failed') },
              { value: 'queued', label: t('planning.queued') },
              { value: 'succeeded', label: t('planning.succeeded') }
            ]
          },
          {
            key: 'kind',
            placeholder: t('planning.taskType'),
            items: [{ value: 'all', label: t('planning.allTaskTypes') }, ...kinds.map((kind) => ({ value: kind, label: kindLabel(kind) }))]
          }
        ]"
        :filter-values="{ status: filters.status, kind: filters.kind }"
        :sort-options="[
          { value: 'lastEvent', label: t('planning.lastEvent') },
          { value: 'attempts', label: t('planning.attemptCount') },
          { value: 'kind', label: t('planning.taskType') }
        ]"
        :sort-by="filters.sort"
        :sort-dir="filters.direction"
        class="px-4"
        @update:search="updateSearch"
        @filter="updateFilter"
        @sort="update({ sort: $event })"
        @toggle-direction="update({ direction: filters.direction === 'desc' ? 'asc' : 'desc' })"
      />
    </header>

    <div ref="list" class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/10 p-4">
      <UAlert v-if="error" class="mb-4" variant="outline" color="error" :title="error" />
      <div v-if="pending && !jobs.length" class="flex justify-center py-12" role="status">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-primary" />
      </div>
      <div v-else-if="!error && !jobs.length" class="py-12 text-center">
        <UIcon name="i-lucide-circle-check-big" class="mx-auto size-10 text-success" />
        <h3 class="mt-3 font-semibold">{{ t(filters.status === 'failed' ? 'planning.noPendingTasks' : 'planning.noMatchingTasks') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ t(filters.status === 'failed' ? 'planning.noPendingTasksDescription' : 'planning.noMatchingTasksDescription') }}</p>
      </div>
      <div v-else class="grid gap-3">
        <div v-if="resource.hasPreviousPage.value" ref="previousSentinel" class="h-px" aria-hidden="true" />
        <div v-if="resource.loadingPreviousPage.value" class="grid gap-3 pb-1" role="status">
          <USkeleton v-for="index in 2" :key="index" class="h-32 w-full" />
        </div>
        <article v-for="job in jobs" :key="job.id" class="rounded-lg border border-default bg-default p-4 shadow-xs">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-md" :class="job.completedAt ? 'bg-success/10 text-success' : job.error ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'">
                <UIcon :name="job.completedAt ? 'i-lucide-circle-check' : job.error ? 'i-lucide-triangle-alert' : 'i-lucide-clock-3'" class="size-5" />
              </span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="font-semibold text-highlighted">{{ kindLabel(job.kind) }}</h3>
                  <UBadge :color="job.completedAt ? 'success' : job.error ? 'error' : 'warning'" variant="subtle">{{ t(job.completedAt ? 'planning.succeeded' : job.error ? 'planning.failed' : 'planning.queued') }}</UBadge>
                  <UBadge v-if="job.trigger === 'reconciliation'" color="neutral" variant="subtle">{{ t('planning.scheduledCheck') }}</UBadge>
                </div>
                <p v-if="job.subject" class="mt-1 truncate text-sm text-muted">{{ job.subject }}</p>
                <p class="mt-1 text-xs text-dimmed">
                  {{ t('planning.lastEventValue', { date: dateTime(job.lastEventAt) }) }} · {{ t('planning.attempts', { count: job.attempts }) }}
                </p>
              </div>
            </div>
            <UButton v-if="!job.completedAt" icon="i-lucide-rotate-cw" size="sm" variant="outline" :loading="retryingId === job.id" :disabled="Boolean(retryingId) || retryingAll" @click="retryJob(job.id)">
              {{ t('planning.retryTask') }}
            </UButton>
          </div>
          <div v-if="job.entity?.type === 'availability'" class="mt-3 grid gap-x-6 gap-y-2 text-sm text-muted sm:grid-cols-2">
            <p class="flex min-w-0 items-center gap-2">
              <UIcon name="i-lucide-user-round" class="size-4 shrink-0" />
              <span class="truncate">{{ job.entity.providerEmail }}</span>
            </p>
            <p class="flex min-w-0 items-center gap-2">
              <UIcon name="i-lucide-clock-3" class="size-4 shrink-0" />
              <span>{{ job.entity.date }}<template v-if="job.entity.endDate"> – {{ job.entity.endDate }}</template>, {{ job.entity.startTime }}–{{ job.entity.endTime }} · {{ job.entity.timezone }}</span>
            </p>
            <p class="flex min-w-0 items-center gap-2">
              <UIcon name="i-lucide-package" class="size-4 shrink-0" />
              <span class="truncate">{{ productSummary(job) }}</span>
            </p>
            <p class="flex min-w-0 items-center gap-2">
              <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
              <span class="truncate">{{ job.entity.calendarId || t('planning.noDestinationCalendar') }}</span>
            </p>
          </div>
          <div v-if="job.error" class="mt-3 rounded-md bg-error/5 px-3 py-2 text-sm text-error">
            <p class="break-words">{{ job.error }}</p>
            <p class="mt-1 text-xs opacity-75">{{ t('planning.nextRetryValue', { date: dateTime(job.availableAt) }) }}</p>
          </div>
        </article>
        <div v-if="resource.hasNextPage.value" ref="nextSentinel" class="h-px" aria-hidden="true" />
        <div v-if="resource.loadingNextPage.value" class="grid gap-3 pt-1" role="status">
          <USkeleton v-for="index in 2" :key="index" class="h-32 w-full" />
        </div>
      </div>
    </div>

    <footer v-if="!error" class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-default bg-default px-4 py-3 text-sm text-muted">
      <span>{{ t('planning.taskCount', { count: pagination.total }) }}</span>
    </footer>
  </section>
</template>
