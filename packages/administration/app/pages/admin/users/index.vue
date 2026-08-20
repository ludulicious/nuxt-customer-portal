<script setup lang="ts">
import type { AdminUserResponse, ApiError } from '@nuxt-customer-portal/core/shared/types/index'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { isAdmin } = storeToRefs(useUserStore())
const administration = useAdministration()

useSeoMeta({ title: () => t('admin.user.list.title') })

if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: t('admin.errors.accessRequired') })
}

const users = ref<AdminUserResponse[]>([])
const loading = ref(true)
const error = ref('')
const showCreateModal = ref(false)
const searchQuery = ref(String(route.query.search ?? ''))
const roleFilter = ref(['admin', 'user'].includes(String(route.query.role)) ? String(route.query.role) : 'all')
const statusFilter = ref(['active', 'banned'].includes(String(route.query.status)) ? String(route.query.status) : 'all')
const sortBy = ref<'name' | 'email' | 'createdAt'>(
  ['email', 'createdAt'].includes(String(route.query.sortBy))
    ? route.query.sortBy as 'email' | 'createdAt'
    : 'name'
)
const sortDir = ref<'asc' | 'desc'>(route.query.sortDir === 'desc' ? 'desc' : 'asc')
const listContainerRef = ref<HTMLElement | null>(null)
const listScrollTop = ref(0)
const scrollRestored = ref(false)
const showFilters = ref(false)
const showSort = ref(false)
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

const roleOptions = computed(() => [
  { label: t('admin.user.list.allRoles'), value: 'all' },
  { label: t('admin.user.roles.admin'), value: 'admin' },
  { label: t('admin.user.roles.user'), value: 'user' }
])
const statusOptions = computed(() => [
  { label: t('admin.user.list.allStatuses'), value: 'all' },
  { label: t('admin.user.status.notBanned'), value: 'active' },
  { label: t('admin.user.status.banned'), value: 'banned' }
])
const sortOptions = computed(() => [
  { label: t('admin.user.list.name'), value: 'name' as const },
  { label: t('admin.user.list.email'), value: 'email' as const },
  { label: t('admin.user.list.created'), value: 'createdAt' as const }
])

function buildListQuery(includeScroll = false) {
  const query: Record<string, string> = {}
  if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
  if (roleFilter.value !== 'all') query.role = roleFilter.value
  if (statusFilter.value !== 'all') query.status = statusFilter.value
  if (sortBy.value !== 'name') query.sortBy = sortBy.value
  if (sortDir.value !== 'asc') query.sortDir = sortDir.value
  if (includeScroll && listScrollTop.value > 0) query.scroll = String(Math.round(listScrollTop.value))
  return query
}

const listReturnPath = computed(() => {
  const query = new URLSearchParams(buildListQuery(true))
  return query.size ? `/admin/users?${query.toString()}` : '/admin/users'
})

const userDetailTo = (user: AdminUserResponse) => ({
  path: `/admin/users/${user.id}`,
  query: { returnTo: listReturnPath.value }
})

const visibleUsers = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase(locale.value)
  const filtered = users.value.filter((user) => {
    const matchesSearch = !query
      || user.name?.toLocaleLowerCase(locale.value).includes(query)
      || user.email.toLocaleLowerCase(locale.value).includes(query)
    const matchesRole = roleFilter.value === 'all' || user.role === roleFilter.value
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'banned' ? Boolean(user.banned) : !user.banned)
    return matchesSearch && matchesRole && matchesStatus
  })

  return filtered.sort((a, b) => {
    let comparison = 0
    if (sortBy.value === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else {
      comparison = String(a[sortBy.value] ?? '').localeCompare(String(b[sortBy.value] ?? ''), locale.value)
    }
    return sortDir.value === 'asc' ? comparison : -comparison
  })
})

const loadUsers = async () => {
  try {
    loading.value = true
    error.value = ''
    users.value = await administration.searchUsers('')
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || t('admin.errors.failedToLoadUsers')
  } finally {
    loading.value = false
    await restoreScroll()
  }
}

async function restoreScroll() {
  if (!import.meta.client || scrollRestored.value) return
  const scroll = Number(route.query.scroll)
  if (!Number.isFinite(scroll) || scroll <= 0) return
  await nextTick()
  if (!listContainerRef.value) return
  listContainerRef.value.scrollTop = scroll
  scrollRestored.value = true
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    router.replace({ path: '/admin/users', query: buildListQuery() })
  }, 300)
})
watch([roleFilter, statusFilter, sortBy, sortDir], () => {
  router.replace({ path: '/admin/users', query: buildListQuery() })
})
onScopeDispose(() => clearTimeout(searchTimer))

await loadUsers()
</script>

<template>
  <div
    ref="listContainerRef"
    class="flex h-full min-h-0 flex-col overflow-hidden"
    @scroll="listScrollTop = listContainerRef?.scrollTop ?? 0"
  >
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <header class="flex items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
        <div class="flex min-w-0 gap-3">
          <UIcon name="i-lucide-users" class="mt-1 size-6 shrink-0 text-primary" />
          <div class="min-w-0">
            <h1 class="text-2xl font-semibold text-highlighted">{{ t('admin.user.list.title') }}</h1>
            <p class="hidden text-sm text-muted sm:block">{{ t('admin.user.list.description') }}</p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UButton class="rounded-full sm:hidden" icon="i-lucide-plus" :aria-label="t('admin.user.list.newUser')" @click="showCreateModal = true" />
          <UButton class="hidden sm:inline-flex" icon="i-lucide-plus" size="sm" variant="outline" @click="showCreateModal = true">
            {{ t('admin.user.list.newUser') }}
          </UButton>
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="sm" :loading="loading" :aria-label="t('common.refresh')" @click="loadUsers" />
        </div>
      </header>

      <div class="border-b border-default pb-4">
        <div class="flex items-center gap-2">
          <UInput v-model="searchQuery" class="min-w-0 flex-1 md:max-w-xs" icon="i-lucide-search" :placeholder="t('admin.user.list.searchPlaceholder')" :loading="loading" clearable />
          <template v-if="!isMobile">
            <USelect v-model="roleFilter" :items="roleOptions" value-key="value" class="w-40" />
            <USelect v-model="statusFilter" :items="statusOptions" value-key="value" class="w-40" />
            <USelect v-model="sortBy" :items="sortOptions" value-key="value" class="w-44" />
            <UButton color="neutral" variant="outline" :icon="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" :aria-label="sortDir === 'asc' ? t('common.ascending') : t('common.descending')" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'" />
          </template>
          <template v-else>
            <UButton variant="outline" icon="i-lucide-filter" :aria-label="t('common.filters')" @click="showFilters = true" />
            <UButton variant="outline" icon="i-lucide-arrow-down-up" :aria-label="t('common.sort')" @click="showSort = true" />
          </template>
        </div>
        <UModal v-model:open="showFilters" :title="t('common.filters')"><template #body><div class="space-y-4"><UFormField :label="t('admin.user.list.role')"><USelect v-model="roleFilter" :items="roleOptions" value-key="value" class="w-full" /></UFormField><UFormField :label="t('admin.user.list.status')"><USelect v-model="statusFilter" :items="statusOptions" value-key="value" class="w-full" /></UFormField></div></template></UModal>
        <UModal v-model:open="showSort" :title="t('common.sort')"><template #body><div class="space-y-4"><UFormField :label="t('common.sortBy')"><USelect v-model="sortBy" :items="sortOptions" value-key="value" class="w-full" /></UFormField><UButton block variant="outline" :icon="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'">{{ t('common.direction') }}</UButton></div></template></UModal>
      </div>

      <UAlert v-if="error" color="error" :title="error" variant="outline" />

      <UEmpty
        v-if="!loading && visibleUsers.length === 0"
        icon="i-lucide-users"
        :title="t('admin.user.list.empty')"
        :description="searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? t('admin.user.list.emptyFiltered') : t('admin.user.list.emptyDescription')"
        variant="outline"
      >
        <template v-if="!searchQuery && roleFilter === 'all' && statusFilter === 'all'" #actions>
          <UButton icon="i-lucide-plus" size="lg" @click="showCreateModal = true">{{ t('admin.user.list.createFirstUser') }}</UButton>
        </template>
      </UEmpty>

      <div v-else-if="!loading" class="grid gap-3">
        <UCard v-for="user in visibleUsers" :key="user.id" :ui="{ body: 'p-0 sm:p-0' }" class="transition-colors hover:ring-1 hover:ring-primary/50">
          <NuxtLink
            :to="userDetailTo(user)"
            :aria-label="t('admin.user.list.viewUser', { name: user.name || user.email })"
            class="group grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <UAvatar :src="user.image ?? undefined" :alt="user.name || user.email" size="md" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate font-semibold text-highlighted">{{ user.name || t('admin.user.list.notAvailable') }}</h2>
                <UBadge :color="user.role === 'admin' ? 'primary' : 'neutral'" variant="subtle">{{ t(`admin.user.roles.${user.role || 'user'}`) }}</UBadge>
                <UBadge v-if="user.banned" color="error" variant="subtle">{{ t('admin.user.status.banned') }}</UBadge>
              </div>
              <p class="mt-1 truncate text-sm text-muted">{{ user.email }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{{ user.emailVerified ? t('admin.user.verification.verified') : t('admin.user.verification.pending') }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ t('admin.user.list.created') }} {{ new Date(user.createdAt).toLocaleDateString(locale) }}</span>
              </div>
            </div>
            <span aria-hidden="true" class="grid size-11 place-items-center rounded-md text-muted group-hover:text-highlighted">
              <UIcon name="i-lucide-chevron-right" class="size-5" />
            </span>
          </NuxtLink>
        </UCard>
      </div>

      <div v-if="loading" class="grid gap-3" role="status">
        <USkeleton v-for="index in 4" :key="index" class="h-24 w-full rounded-lg" />
        <span class="sr-only">{{ t('admin.user.list.loading') }}</span>
      </div>

      </div>
    </div>
    <footer class="flex min-h-12 shrink-0 items-center justify-between border-t border-default px-4 pt-3 text-sm text-muted sm:px-6 lg:px-8">
      <span>{{ t('admin.user.list.resultCount', { count: visibleUsers.length }) }}</span>
      <span v-if="visibleUsers.length !== users.length">{{ t('admin.user.list.totalCount', { count: users.length }) }}</span>
    </footer>

    <AdminCreateUserModal v-model:open="showCreateModal" @success="loadUsers" />
  </div>
</template>
