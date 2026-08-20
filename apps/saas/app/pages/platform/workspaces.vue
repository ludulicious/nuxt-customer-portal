<script setup lang="ts">
definePageMeta({ public: true })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const workspaceApi = usePlatformWorkspaces()
const statuses = ['all', 'PENDING_EMAIL', 'PROVISIONING', 'ACTIVE', 'READ_ONLY', 'DELETION_SCHEDULED', 'ERROR'] as const
const sorts = ['createdAt', 'slug', 'status'] as const
const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const status = ref<typeof statuses[number]>(statuses.includes(route.query.status as typeof statuses[number]) ? route.query.status as typeof statuses[number] : 'all')
const sortBy = ref<typeof sorts[number]>(sorts.includes(route.query.sortBy as typeof sorts[number]) ? route.query.sortBy as typeof sorts[number] : 'createdAt')
const sortDir = ref<'asc' | 'desc'>(route.query.sortDir === 'asc' ? 'asc' : 'desc')
const page = ref(Number(route.query.page) > 0 ? Number(route.query.page) : 1)
const response = ref<PlatformWorkspaceListResponse | null>(null)
const pending = ref(false)
const loadError = ref<unknown>(null)
const transitionId = ref<string | null>(null)
const loadMoreSentinel = ref<HTMLElement | null>(null)
const statusOptions = computed(() => statuses.map(value => ({ label: value === 'all' ? t('platform.workspaces.filters.allStatuses') : t(`platform.workspaces.status.${value}`), value })))
const sortOptions = computed(() => sorts.map(value => ({ label: t(`platform.workspaces.sort.${value}`), value })))
const workspaces = computed(() => response.value?.items ?? [])
const pagination = computed(() => response.value?.pagination)
const queryState = () => ({ search: search.value || undefined, status: status.value === 'all' ? undefined : status.value, sortBy: sortBy.value, sortDir: sortDir.value, page: page.value > 1 ? page.value : undefined })
const routeState = () => JSON.stringify({ search: route.query.search || undefined, status: route.query.status || undefined, sortBy: route.query.sortBy || 'createdAt', sortDir: route.query.sortDir === 'asc' ? 'asc' : 'desc', page: Number(route.query.page) > 1 ? Number(route.query.page) : undefined })

const load = async (append = false) => {
  pending.value = !append
  loadError.value = null
  try {
    const nextResponse = await workspaceApi.list(queryState())
    if (append && response.value) {
      response.value = { ...nextResponse, items: [...response.value.items, ...nextResponse.items] }
    } else {
      response.value = nextResponse
    }
    page.value = nextResponse.pagination.page
  } catch (error) {
    loadError.value = error
  } finally {
    pending.value = false
  }
}
const loadMore = async () => {
  if (pending.value || !pagination.value?.hasNext) return
  page.value += 1
  await load(true)
}
const syncAndLoad = async (resetPage = false) => {
  if (resetPage) page.value = 1
  const query = queryState()
  if (routeState() !== JSON.stringify(query)) await router.replace({ query })
  await load()
}
const transition = async (workspace: PlatformWorkspace, nextStatus: string) => {
  transitionId.value = workspace.id
  try { await workspaceApi.transition(workspace.id, nextStatus); await load() } finally { transitionId.value = null }
}
watch(search, () => syncAndLoad(true), { flush: 'post' })
watch([status, sortBy, sortDir], () => syncAndLoad(true), { flush: 'post' })
watch(() => route.fullPath, async () => {
  if (routeState() === JSON.stringify(queryState())) return
  search.value = typeof route.query.search === 'string' ? route.query.search : ''
  status.value = statuses.includes(route.query.status as typeof statuses[number]) ? route.query.status as typeof statuses[number] : 'all'
  sortBy.value = sorts.includes(route.query.sortBy as typeof sorts[number]) ? route.query.sortBy as typeof sorts[number] : 'createdAt'
  sortDir.value = route.query.sortDir === 'asc' ? 'asc' : 'desc'
  page.value = Number(route.query.page) > 0 ? Number(route.query.page) : 1
  await load()
})
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) void loadMore()
  }, { rootMargin: '320px' })
  if (loadMoreSentinel.value) observer.observe(loadMoreSentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
await load()
</script>

<template>
  <main class="mx-auto h-full min-h-0 max-w-6xl overflow-y-auto px-6 py-10 lg:px-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="text-sm font-semibold uppercase tracking-widest text-primary">Control plane</p><h1 class="mt-2 text-3xl font-bold">{{ t('platform.workspaces.title') }}</h1><p class="mt-2 text-muted">{{ t('platform.workspaces.description') }}</p></div>
      <UButton to="/platform/onboarding" icon="i-lucide-plus">{{ t('platform.workspaces.new') }}</UButton>
    </div>
    <div class="mt-8 flex flex-wrap gap-3">
      <UInput v-model="search" class="min-w-64 flex-1" icon="i-lucide-search" :placeholder="t('platform.workspaces.search')" />
      <USelect v-model="status" :items="statusOptions" class="w-48" /><USelect v-model="sortBy" :items="sortOptions" class="w-40" />
      <UButton color="neutral" variant="outline" :aria-label="t('platform.workspaces.toggleSort')" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"><UIcon :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" /></UButton>
    </div>
    <UAlert v-if="loadError" class="mt-6" color="error" :title="t('platform.workspaces.loadFailed')" :description="t('platform.workspaces.loadFailedDescription')" />
    <div v-else-if="pending" class="flex justify-center py-16"><UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" /></div>
    <UEmpty v-else-if="workspaces.length === 0" class="mt-8" :icon="search || status !== 'all' ? 'i-lucide-search-x' : 'i-lucide-building-2'" :title="search || status !== 'all' ? t('platform.workspaces.emptyFiltered') : t('platform.workspaces.empty')" :description="t('platform.workspaces.emptyDescription')"><template #actions><UButton to="/platform/onboarding">{{ t('platform.workspaces.createFirst') }}</UButton></template></UEmpty>
    <div v-else class="mt-6 space-y-3">
      <UCard v-for="workspace in workspaces" :key="workspace.id"><div class="flex flex-wrap items-center justify-between gap-4"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h2 class="font-semibold">{{ workspace.slug }}</h2><UBadge variant="subtle">{{ t(`platform.workspaces.status.${workspace.lifecycleStatus}`) }}</UBadge></div><a class="mt-1 block truncate text-sm text-muted" :href="`https://${workspace.canonicalDomain}`">{{ workspace.canonicalDomain }}</a><p class="mt-2 text-xs text-muted">{{ workspace.databaseMode }} · {{ workspace.selectedModules.join(', ') || '—' }}</p></div><div class="flex flex-wrap gap-2"><UButton v-if="workspace.lifecycleStatus === 'ACTIVE'" size="sm" color="warning" variant="soft" :loading="transitionId === workspace.id" @click="transition(workspace, 'READ_ONLY')">{{ t('platform.workspaces.actions.readOnly') }}</UButton><UButton v-if="workspace.lifecycleStatus === 'READ_ONLY'" size="sm" variant="soft" :loading="transitionId === workspace.id" @click="transition(workspace, 'ACTIVE')">{{ t('platform.workspaces.actions.restore') }}</UButton><UButton v-if="workspace.lifecycleStatus === 'READ_ONLY'" size="sm" color="error" variant="soft" :loading="transitionId === workspace.id" @click="transition(workspace, 'DELETION_SCHEDULED')">{{ t('platform.workspaces.actions.scheduleDeletion') }}</UButton></div></div></UCard>
      <div ref="loadMoreSentinel" class="flex min-h-12 items-center justify-center py-4" aria-live="polite"><UIcon v-if="pending" name="i-lucide-loader-circle" class="size-5 animate-spin text-primary" /><span v-else-if="!pagination?.hasNext" class="text-sm text-muted">{{ t('platform.workspaces.allLoaded') }}</span></div>
    </div>
    <p v-if="pagination" class="mt-6 border-t border-default pt-4 text-sm text-muted">{{ t('platform.workspaces.resultCount', { count: pagination.totalItems }) }}</p>
  </main>
</template>
