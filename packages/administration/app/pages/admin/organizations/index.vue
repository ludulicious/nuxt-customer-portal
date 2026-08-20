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
  <div
    ref="listContainerRef"
    class="flex h-full min-h-0 flex-col overflow-hidden"
    @scroll="onListScroll"
  >
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <header class="flex flex-col gap-3 border-b border-default pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex min-w-0 gap-3">
          <UIcon name="i-lucide-building-2" class="mt-1 size-6 shrink-0 text-primary" />
          <div class="min-w-0">
            <h1 class="text-2xl font-semibold text-highlighted">
              {{ t('admin.organization.list.title') }}
            </h1>
            <p class="text-sm text-muted">
              {{ t('admin.organization.list.description') }}
            </p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1 self-end sm:self-auto">
          <UButton
            icon="i-lucide-plus"
            size="sm"
            variant="outline"
            to="/admin/organizations/create"
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
      </header>

      <div class="grid grid-cols-1 gap-2 border-b border-default pb-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
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

      <UAlert v-if="error" color="error" :title="error" variant="outline" />

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

      <div v-else-if="!loading" class="grid gap-3">
        <UCard
          v-for="org in filteredAndSortedOrganizations"
          :key="org.id"
          :ui="{ body: 'p-0 sm:p-0' }"
          class="transition-colors hover:ring-1 hover:ring-primary/50"
        >
          <NuxtLink
            :to="getViewTo(org)"
            :aria-label="t('admin.organization.list.viewOrganization', { name: org.name })"
            class="group grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <UAvatar
              :src="org.logo ?? undefined"
              :alt="org.name"
              size="md"
            />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate font-semibold text-highlighted">
                  {{ org.name }}
                </h2>
                <UBadge
                  :color="org.organizationType === 'PROVIDER' ? 'primary' : 'neutral'"
                  variant="subtle"
                >
                  {{ t(org.organizationType === 'PROVIDER' ? 'admin.organization.list.provider' : 'admin.organization.list.client') }}
                </UBadge>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span class="truncate">{{ org.slug }}</span>
                <span aria-hidden="true" class="hidden sm:inline">·</span>
                <span class="text-xs sm:text-sm">
                  {{ t('admin.organization.list.created') }} {{ new Date(org.createdAt).toLocaleDateString() }}
                </span>
              </div>
            </div>
            <span class="grid size-11 place-items-center rounded-md text-muted group-hover:text-highlighted" aria-hidden="true">
              <UIcon name="i-lucide-chevron-right" class="size-5" />
            </span>
          </NuxtLink>
        </UCard>
      </div>

      <div v-if="loading" class="grid gap-3" role="status">
        <USkeleton v-for="i in 4" :key="i" class="h-20 w-full rounded-lg" />
        <span class="sr-only">{{ t('admin.organization.list.loading') }}</span>
      </div>

      </div>
    </div>
    <footer class="flex min-h-12 shrink-0 items-center justify-between border-t border-default px-4 pt-3 text-sm text-muted sm:px-6 lg:px-8">
      <span>{{ t('admin.organization.list.resultCount', { count: filteredAndSortedOrganizations.length }) }}</span>
      <span v-if="searchQuery">{{ t('admin.organization.list.totalCount', { count: organizations.length }) }}</span>
    </footer>
  </div>
</template>
