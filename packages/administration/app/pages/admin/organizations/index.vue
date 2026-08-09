<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const { isAdmin } = storeToRefs(userStore)

useSeoMeta({
  title: () => t('admin.organization.list.title')
})

if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: 'Admin access required' })
}

const loading = ref(true)
const error = ref('')
const organizations = ref<AdminOrganizationsResponse>([])
const searchQuery = ref((route.query.search as string) ?? '')
const sortBy = ref<'name' | 'createdAt'>(
  route.query.sortBy === 'createdAt' ? 'createdAt' : 'name'
)
const sortDir = ref<'asc' | 'desc'>(
  route.query.sortDir === 'desc' ? 'desc' : 'asc'
)
const listScrollTop = ref(0)
const listContainerRef = ref<HTMLElement | null>(null)
const scrollRestored = ref(false)

const sortOptions = computed(() => [
  { label: t('admin.organization.list.name'), value: 'name' as const },
  { label: t('admin.organization.list.created'), value: 'createdAt' as const }
])

const currentSortLabel = computed(() =>
  sortOptions.value.find(o => o.value === sortBy.value)?.label
  || t('common.sort')
)

const sortDropdownItems = computed(() =>
  sortOptions.value.map(option => ({
    label: option.label,
    icon: sortBy.value === option.value ? 'i-lucide-check' : undefined,
    onSelect: () => {
      sortBy.value = option.value
    }
  }))
)

const toggleSortDir = () => {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

const openOrganization = (org: { slug: string }) => {
  return navigateTo(getViewTo(org))
}

function buildListQuery(includeScroll = false) {
  const q: Record<string, string> = {}
  if (searchQuery.value.trim()) q.search = searchQuery.value.trim()
  if (sortBy.value !== 'name') q.sortBy = sortBy.value
  if (sortDir.value !== 'asc') q.sortDir = sortDir.value
  if (includeScroll && listScrollTop.value > 0) q.scroll = String(listScrollTop.value)
  return q
}

function getViewTo(org: { slug: string }) {
  const query = new URLSearchParams({ from: 'admin-organizations', ...buildListQuery(true) })
  return `/admin/organizations/${org.slug}?${query.toString()}`
}

const filteredAndSortedOrganizations = computed(() => {
  let list = [...organizations.value]
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      org =>
        org.name?.toLowerCase().includes(q)
        || org.slug?.toLowerCase().includes(q)
    )
  }
  list.sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'name') {
      cmp = (a.name ?? '').localeCompare(b.name ?? '')
    } else {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return list
})

const loadOrganizations = async () => {
  try {
    loading.value = true
    error.value = ''
    organizations.value = await $fetch<AdminOrganizationsResponse>('/api/admin/organizations')
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || t('admin.errors.failedToLoadUsers')
} finally {
  loading.value = false
  nextTick(() => restoreScrollAfterLoad())
}
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    router.replace({ path: '/admin/organizations', query: buildListQuery() })
  }, 300)
})

watch([sortBy, sortDir], () => {
  router.replace({ path: '/admin/organizations', query: buildListQuery() })
})

function onListScroll() {
  if (listContainerRef.value) listScrollTop.value = listContainerRef.value.scrollTop
}

onMounted(() => {
  loadOrganizations()
})

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
})

async function restoreScrollAfterLoad() {
  const scrollVal = route.query.scroll
  if (scrollRestored.value || scrollVal === undefined || scrollVal === null) return
  const scrollNum = Number(scrollVal)
  if (!Number.isFinite(scrollNum) || scrollNum < 0) return
  await nextTick()
  if (!listContainerRef.value) return
  listContainerRef.value.scrollTop = scrollNum
  scrollRestored.value = true
}

watch([loading, listContainerRef], () => {
  if (!loading.value && listContainerRef.value) restoreScrollAfterLoad()
}, { flush: 'post' })
</script>

<template>
  <UDashboardPanel
    id="admin-organizations"
    class="min-h-0 overflow-hidden"
    style="height: calc(100dvh - var(--ui-header-height));"
    :ui="{ body: 'flex-1 min-h-0 p-0 sm:p-0 overflow-hidden' }"
  >
    <template #body>
      <div class="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header class="mb-5 shrink-0 border-b border-default pb-5">
          <div class="flex items-end justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-6 shrink-0" />
                <h1 class="text-2xl font-semibold text-highlighted">
                  {{ t('admin.organization.list.title') }}
                </h1>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ t('admin.organization.list.description') }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                icon="i-lucide-plus"
                size="sm"
                variant="outline"
                class="h-8"
                :to="'/admin/organizations/create'"
              >
                <span class="hidden sm:inline">{{ t('admin.organization.list.newOrganization') }}</span>
              </UButton>
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                size="sm"
                :loading="loading"
                :aria-label="t('common.refresh')"
                @click="loadOrganizations"
              />
            </div>
          </div>
        </header>

        <div class="mb-4 grid shrink-0 grid-cols-1 gap-3 border-b border-default pb-5 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
          <UInput
            v-model="searchQuery"
            :placeholder="t('admin.organization.list.searchPlaceholder')"
            icon="i-lucide-search"
            :loading="loading"
            class="w-full"
            clearable
          />
          <div class="flex items-center gap-2">
            <UDropdownMenu
              :items="sortDropdownItems"
              :content="{ align: 'end', collisionPadding: 12 }"
              class="min-w-0 flex-1"
            >
              <UButton
                icon="i-lucide-arrow-down-up"
                variant="outline"
                class="w-full justify-between"
              >
                <span class="truncate">{{ currentSortLabel }}</span>
                <UIcon name="i-lucide-chevron-down" class="size-4 opacity-60" />
              </UButton>
            </UDropdownMenu>
            <UButton
              :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'"
              variant="outline"
              :aria-label="sortDir === 'asc' ? t('common.ascending') : t('common.descending')"
              @click="toggleSortDir"
            />
          </div>
        </div>

        <div ref="listContainerRef" class="-mx-1 min-h-0 flex-1 overflow-y-auto" @scroll="onListScroll">
          <div class="px-1 pb-4 pt-1">
            <UAlert v-if="error" color="error" :title="error" class="mb-4" variant="outline" />

            <UEmpty
              v-if="filteredAndSortedOrganizations.length === 0 && !loading"
              icon="i-lucide-building-2"
              :title="t('admin.organization.list.empty')"
              :description="searchQuery ? t('admin.organization.list.emptyFiltered') : t('admin.organization.list.emptyDescription')"
              variant="outline"
            >
              <template v-if="!searchQuery" #actions>
                <UButton icon="i-lucide-plus" size="lg" to="/admin/organizations/create">
                  {{ t('admin.organization.list.createFirstOrganization') }}
                </UButton>
              </template>
            </UEmpty>

            <div v-else class="grid gap-3">
              <UCard
                v-for="org in filteredAndSortedOrganizations"
                :key="org.id"
                class="cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                role="button"
                tabindex="0"
                @click="openOrganization(org)"
                @keydown.enter="openOrganization(org)"
                @keydown.space.prevent="openOrganization(org)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h2 class="truncate font-medium">
                      {{ org.name }}
                    </h2>
                    <p class="mt-0.5 truncate text-sm text-muted">
                      {{ org.slug }}
                    </p>
                    <p class="mt-2 text-xs text-muted">
                      {{ t('admin.organization.detail.created') }} {{ new Date(org.createdAt).toLocaleDateString() }}
                    </p>
                  </div>
                  <UButton
                    :to="getViewTo(org)"
                    icon="i-lucide-chevron-right"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :aria-label="t('admin.organization.list.viewOrganization', { name: org.name })"
                    @click.stop
                    @keydown.stop
                  />
                </div>
              </UCard>
            </div>

            <div v-if="loading" class="grid gap-3" role="status">
              <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-lg" />
              <span class="sr-only">{{ t('admin.organization.list.loading') }}</span>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center justify-between border-t border-default pt-3 text-sm text-muted">
          <span>{{ t('admin.organization.list.resultCount', { count: filteredAndSortedOrganizations.length }) }}</span>
          <span v-if="searchQuery">{{ t('admin.organization.list.totalCount', { count: organizations.length }) }}</span>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
