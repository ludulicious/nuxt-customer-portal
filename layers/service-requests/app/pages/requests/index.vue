<script setup lang="ts">
import { useAutoPagination } from '#portal/app/composables/useAutoPagination'
import type {
  ServiceRequest,
  ServiceRequestCreateInput,
  ServiceRequestFilters,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceRequestUpdateInput,
  ServiceRequestWithRelations
} from '#layers/service-requests/shared/types/service-request'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { currentUser } = usePortalSession()
const { can } = useServiceRequestAccess()

useSeoMeta({
  title: () => t('features.serviceRequests.title')
})

const { getStatusColor, getStatusBadgeText, getPriorityBadgeText, getPriorityColor, statusOptions, priorityOptions } = useServiceRequests()

// Mobile breakpoint detection
const breakpoints = useBreakpoints({
  mobile: 768
})
const isMobile = breakpoints.smaller('mobile')

// Filter modal state
const showFiltersModal = ref(false)
const showSortModal = ref(false)

const pageSize = 20
const {
  items: list,
  pagination,
  pending,
  loadingNextPage,
  loadingPreviousPage,
  hasNextPage,
  hasPreviousPage,
  error: loadError,
  loadPage,
  loadNextPage: appendNextPage,
  loadPreviousPage: prependPreviousPage
} = usePaginatedServiceRequests(pageSize)

// Initialize from URL (with defaults)
const currentPage = ref(Math.max(1, Number(route.query.page) || 1))
const listContainerRef = ref<HTMLElement | null>(null)
const loadPreviousSentinelRef = ref<HTMLElement | null>(null)
const loadMoreSentinelRef = ref<HTMLElement | null>(null)

// Drawer state (create / view / edit)
type DrawerMode = 'create' | 'view' | 'edit'
const drawerOpen = ref(false)
const drawerMode = ref<DrawerMode>('view')
const selectedRequest = ref<ServiceRequest | null>(null)
const mutationPending = ref(false)

const drawerTitle = computed(() => {
  if (drawerMode.value === 'create') return t('features.serviceRequests.create')
  if (drawerMode.value === 'edit') return t('features.serviceRequests.edit')
  return selectedRequest.value?.title || t('features.serviceRequests.title')
})

const canCreate = computed(() => can('create'))
const isOwner = computed(() => {
  if (!selectedRequest.value?.createdById) return false
  return selectedRequest.value.createdById === currentUser.value?.id
})
const canEdit = computed(() => isOwner.value || can('update'))
const canDelete = computed(() => isOwner.value || can('delete'))

const showDeleteConfirm = ref(false)

const openCreateDrawer = () => {
  drawerMode.value = 'create'
  selectedRequest.value = null
  drawerOpen.value = true
}

const closeDrawer = () => {
  drawerOpen.value = false
}

// Filter state (init from URL)
const statusFilter = ref<ServiceRequestStatus | undefined>(
  (route.query.status as ServiceRequestStatus) || undefined
)
const priorityFilter = ref<ServiceRequestPriority | undefined>(
  (route.query.priority as ServiceRequestPriority) || undefined
)
const categoryFilter = ref<string | undefined>(
  (route.query.category as string) || undefined
)
const searchQuery = ref((route.query.search as string) ?? '')

// Sort state (init from URL)
const sortBy = ref<'createdAt' | 'status' | 'priority'>(
  ['createdAt', 'status', 'priority'].includes(route.query.sortBy as string)
    ? (route.query.sortBy as 'createdAt' | 'status' | 'priority')
    : 'createdAt'
)
const sortDir = ref<'asc' | 'desc'>(
  route.query.sortDir === 'asc' ? 'asc' : 'desc'
)

const sortOptions = computed(() => [
  { label: t('features.serviceRequests.fields.createdAt'), value: 'createdAt' as const },
  { label: t('features.serviceRequests.fields.status'), value: 'status' as const },
  { label: t('features.serviceRequests.fields.priority'), value: 'priority' as const }
])

const currentSortLabel = computed(() => {
  return sortOptions.value.find(o => o.value === sortBy.value)?.label || ''
})

const sortDropdownItems = computed(() => [
  sortOptions.value.map(option => ({
    label: option.label,
    icon: sortBy.value === option.value ? 'i-lucide-check' : undefined,
    onSelect: () => {
      sortBy.value = option.value
    }
  }))
])

const toggleSortDir = () => {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

function buildListQuery(includePage = true) {
  const q: Record<string, string> = {}
  if (searchQuery.value.trim()) q.search = searchQuery.value.trim()
  if (statusFilter.value) q.status = statusFilter.value
  if (priorityFilter.value) q.priority = priorityFilter.value
  if (categoryFilter.value) q.category = categoryFilter.value
  if (sortBy.value !== 'createdAt') q.sortBy = sortBy.value
  if (sortDir.value !== 'desc') q.sortDir = sortDir.value
  if (includePage && currentPage.value > 1) q.page = String(currentPage.value)
  return q
}

function getDetailTo(request: ServiceRequestWithRelations) {
  const query = new URLSearchParams({ from: 'list', ...buildListQuery() })
  return `/requests/${request.id}?${query.toString()}`
}

// Extract unique categories from loaded requests
const categoryOptions = computed(() => {
  const categories = new Set<string>()
  list.value.forEach(request => {
    if (request.category) {
      categories.add(request.category)
    }
  })
  const sortedCategories = Array.from(categories).sort()
  return [
    { label: t('features.serviceRequests.filters.allCategories'), value: undefined },
    ...sortedCategories.map(cat => ({ label: cat, value: cat }))
  ]
})

const currentFilters = (): ServiceRequestFilters => ({
  status: statusFilter.value,
  priority: priorityFilter.value,
  category: categoryFilter.value,
  search: searchQuery.value.trim() || undefined,
  sortBy: sortBy.value,
  sortDir: sortDir.value
})

const loadData = async () => {
  try {
    const result = await loadPage(currentFilters(), {
      page: currentPage.value,
      pageSize
    })

    if (result && result.pagination.pageCount > 0 && currentPage.value > result.pagination.pageCount) {
      currentPage.value = result.pagination.pageCount
      await updateRoute()
      await loadData()
    }
  } catch (e) {
    console.error(e)
  }
}

const loadNextPage = async () => {
  try {
    const result = await appendNextPage(currentFilters())

    if (!result) return
    currentPage.value = result.pagination.page
    await updateRoute()
  } catch (e) {
    console.error(e)
  }
}

const loadPreviousPage = async () => {
  const container = listContainerRef.value
  const previousScrollHeight = container?.scrollHeight ?? 0

  try {
    const result = await prependPreviousPage(currentFilters())
    if (!result) return

    await nextTick()
    if (container) {
      container.scrollTop += container.scrollHeight - previousScrollHeight
    }
    currentPage.value = result.pagination.page
    await updateRoute()
  } catch (e) {
    console.error(e)
  }
}

const refresh = async () => {
  currentPage.value = 1
  await updateRoute()
  await loadData()
}

type WithOptionalCategory = { category?: string }
const sanitizeCreateOrUpdatePayload = <T extends WithOptionalCategory>(data: T): T => {
  // Avoid storing empty-string category
  const payload = { ...data } as T & WithOptionalCategory
  if (typeof payload.category === 'string' && payload.category.trim() === '') {
    delete (payload as WithOptionalCategory).category
  }
  return payload
}

const handleCreate = async (data: ServiceRequestCreateInput) => {
  mutationPending.value = true
  try {
    await $fetch<ServiceRequest>('/api/service-requests', {
      method: 'POST',
      body: sanitizeCreateOrUpdatePayload(data)
    })

    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.createSuccess')
    })

    closeDrawer()
    await refresh()
  } catch (e) {
    console.error(e)
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.createError'),
      color: 'error'
    })
  } finally {
    mutationPending.value = false
  }
}

const handleUpdate = async (data: ServiceRequestCreateInput) => {
  if (!selectedRequest.value?.id) return

  mutationPending.value = true
  try {
    const updated = await $fetch<ServiceRequest>(`/api/service-requests/${selectedRequest.value.id}`, {
      method: 'PATCH',
      body: sanitizeCreateOrUpdatePayload(data as ServiceRequestUpdateInput)
    })

    // Keep local selection in sync
    selectedRequest.value = updated

    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.updateSuccess')
    })

    closeDrawer()
    await refresh()
  } catch (e) {
    console.error(e)
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.updateError'),
      color: 'error'
    })
  } finally {
    mutationPending.value = false
  }
}

const handleDelete = async () => {
  if (!selectedRequest.value?.id) return

  mutationPending.value = true
  try {
    await $fetch(`/api/service-requests/${selectedRequest.value.id}`, {
      method: 'DELETE' as never
    })

    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.deleteSuccess')
    })

    closeDrawer()
    await refresh()
  } catch (e) {
    console.error(e)
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.deleteError'),
      color: 'error'
    })
  } finally {
    mutationPending.value = false
  }
}

const editInitialData = computed<Partial<ServiceRequest> | undefined>(() => {
  if (drawerMode.value !== 'edit') return undefined
  return selectedRequest.value ?? undefined
})

const updateRoute = () => router.replace({ path: '/requests', query: buildListQuery() })

const getPageTo = (page: number) => {
  const query = buildListQuery(false)
  if (page > 1) query.page = String(page)
  return { path: '/requests', query }
}

// Debounced search function
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(async () => {
    currentPage.value = 1
    await updateRoute()
    await loadData()
  }, 300) // 300ms debounce
}

// Watch filters and reset pagination when they change
watch([statusFilter, priorityFilter, categoryFilter], async () => {
  currentPage.value = 1
  await updateRoute()
  await loadData()
})

watch([sortBy, sortDir], async () => {
  currentPage.value = 1
  await updateRoute()
  await loadData()
})

// Watch search query with debouncing
watch(searchQuery, () => {
  handleSearch()
})

watch(() => route.query.page, async (page) => {
  const nextPage = Math.max(1, Number(page) || 1)
  if (nextPage === currentPage.value) return
  currentPage.value = nextPage
  await loadData()
  listContainerRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
})

useAutoPagination({
  sentinel: loadMoreSentinelRef,
  scrollContainer: listContainerRef,
  canLoadMore: hasNextPage,
  loading: pending,
  loadMore: loadNextPage
})

useAutoPagination({
  sentinel: loadPreviousSentinelRef,
  scrollContainer: listContainerRef,
  canLoadMore: hasPreviousPage,
  loading: pending,
  loadMore: loadPreviousPage,
  rootMargin: '240px 0px 0px 0px'
})

await loadData()

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString()
}

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
})
</script>

<template>
  <UDashboardPanel
    id="service-requests"
    class="min-h-0 overflow-hidden"
    style="height: calc(100dvh - var(--ui-header-height));"
    :ui="{ body: 'flex flex-col gap-4 sm:gap-6 flex-1 min-h-0 p-4 sm:p-6 overflow-hidden' }"
  >
    <template #header>
      <UDashboardNavbar :ui="{ right: 'gap-3' }" :toggle="false">
        <template #leading>
          <UIcon name="i-lucide-ticket" class="size-6 shrink-0" />
          <span class="text-lg font-semibold text-gray-900 dark:text-white">
            Service Requests
          </span>
        </template>

        <template #right>
          <div class="flex gap-2 w-full sm:w-auto">
            <UButton
              icon="i-lucide-plus"
              color="primary"
              class="flex-1 sm:flex-none"
              :title="t('features.serviceRequests.create')"
              :disabled="!canCreate"
              @click="openCreateDrawer"
            />
            <UButton
              icon="i-lucide-refresh-cw"
              variant="outline"
              :loading="pending"
              class="flex-1 sm:flex-none"
              :title="t('common.refresh')"
              @click="refresh"
            />
          </div>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <div class="flex items-center gap-2 w-full">
            <UInput
              v-model="searchQuery"
              :placeholder="t('common.searchPlaceholder')"
              icon="i-lucide-search"
              :loading="pending"
              class="flex-1 max-w-md"
              clearable
            />
            <USelect
              v-if="!isMobile"
              v-model="statusFilter"
              :items="statusOptions"
              :placeholder="t('features.serviceRequests.filters.status')"
              class="w-48"
            >
              <template #item="{ item }">
                <div class="flex items-center justify-between w-full gap-2">
                  <span class="flex-1 truncate">{{ item.label }}</span>
                  <UBadge
                    v-if="item.badgeText"
                    :color="item.badgeColor as any"
                    size="xs"
                    class="shrink-0 min-w-[100px] justify-center"
                  >
                    {{ item.badgeText }}
                  </UBadge>
                </div>
              </template>
            </USelect>
            <USelect
              v-if="!isMobile"
              v-model="priorityFilter"
              :items="priorityOptions"
              :placeholder="t('features.serviceRequests.filters.priority')"
              class="w-48"
            >
              <template #item="{ item }">
                <div class="flex items-center justify-between w-full gap-2">
                  <span class="flex-1 truncate">{{ item.label }}</span>
                  <UBadge
                    v-if="item.badgeText"
                    :color="item.badgeColor as any"
                    size="xs"
                    class="shrink-0 min-w-[100px] justify-center"
                  >
                    {{ item.badgeText }}
                  </UBadge>
                </div>
              </template>
            </USelect>
            <USelect
              v-if="!isMobile"
              v-model="categoryFilter"
              :items="categoryOptions"
              :placeholder="t('features.serviceRequests.filters.category')"
              class="w-48"
            />
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              v-if="isMobile"
              icon="i-lucide-filter"
              variant="outline"
              @click="showFiltersModal = true"
            >
              Filters
            </UButton>
            <UButton
              v-if="isMobile"
              icon="i-lucide-arrow-down-up"
              variant="outline"
              :title="t('common.sort')"
              @click="showSortModal = true"
            >
              {{ t('common.sort') }}
            </UButton>

            <UDropdownMenu
              v-if="!isMobile"
              :items="sortDropdownItems"
              :content="{ align: 'end', collisionPadding: 12 }"
            >
              <UButton
                icon="i-lucide-arrow-down-up"
                variant="outline"
                class="w-48 justify-between"
              >
                <span class="truncate">{{ currentSortLabel }}</span>
                <UIcon name="i-lucide-chevron-down" class="size-4 opacity-60" />
              </UButton>
            </UDropdownMenu>
            <UButton
              v-if="!isMobile"
              :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'"
              variant="outline"
              :title="sortDir === 'asc' ? t('common.ascending') : t('common.descending')"
              @click="toggleSortDir"
            />
          </div>
        </template>
      </UDashboardToolbar>

      <!-- Mobile Filters Modal -->
      <UModal v-model:open="showFiltersModal" :title="t('features.serviceRequests.filters.title')" :ui="{ content: 'w-full sm:max-w-md' }">
        <template #body>
          <div class="space-y-4">
            <UFormField :label="t('features.serviceRequests.fields.status')">
              <USelect
                v-model="statusFilter"
                class="w-full"
                :items="statusOptions"
                :placeholder="t('features.serviceRequests.filters.status')"
              >
                <template #item="{ item }">
                  <div class="flex items-center justify-between w-full gap-2">
                    <span class="flex-1 truncate">{{ item.label }}</span>
                    <UBadge
                      v-if="item.badgeText"
                      :color="item.badgeColor as any"
                      size="xs"
                      class="shrink-0 min-w-[100px] justify-center"
                    >
                      {{ item.badgeText }}
                    </UBadge>
                  </div>
                </template>
              </USelect>
            </UFormField>

            <UFormField :label="t('features.serviceRequests.fields.priority')">
              <USelect
                v-model="priorityFilter"
                :items="priorityOptions"
                :placeholder="t('features.serviceRequests.filters.priority')"
                class="w-full"
              >
                <template #item="{ item }">
                  <div class="flex items-center justify-between w-full gap-2">
                    <span class="flex-1 truncate">{{ item.label }}</span>
                    <UBadge
                      v-if="item.badgeText"
                      :color="item.badgeColor as any"
                      size="xs"
                      class="shrink-0 min-w-[100px] justify-center"
                    >
                      {{ item.badgeText }}
                    </UBadge>
                  </div>
                </template>
              </USelect>
            </UFormField>

            <UFormField :label="t('features.serviceRequests.fields.category')">
              <USelect
                v-model="categoryFilter"
                class="w-full"
                :items="categoryOptions"
                :placeholder="t('features.serviceRequests.filters.category')"
              />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="outline"
              @click="showFiltersModal = false"
            >
              Close
            </UButton>
          </div>
        </template>
      </UModal>

      <!-- Mobile Sort Modal -->
      <UModal v-model:open="showSortModal" :title="t('common.sort')" :ui="{ content: 'w-full sm:max-w-md' }">
        <template #body>
          <div class="space-y-4">
            <UFormField :label="t('common.sortBy')">
              <USelect
                v-model="sortBy"
                class="w-full"
                :items="sortOptions"
                :placeholder="t('common.sortBy')"
              />
            </UFormField>

            <UFormField :label="t('common.direction')">
              <div class="flex gap-2">
                <UButton
                  class="flex-1"
                  :variant="sortDir === 'asc' ? 'solid' : 'outline'"
                  :icon="sortDir === 'asc' ? 'i-lucide-check' : undefined"
                  @click="sortDir = 'asc'"
                >
                  {{ t('common.ascending') }}
                </UButton>
                <UButton
                  class="flex-1"
                  :variant="sortDir === 'desc' ? 'solid' : 'outline'"
                  :icon="sortDir === 'desc' ? 'i-lucide-check' : undefined"
                  @click="sortDir = 'desc'"
                >
                  {{ t('common.descending') }}
                </UButton>
              </div>
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="showSortModal = false">
              {{ t('common.close') }}
            </UButton>
          </div>
        </template>
      </UModal>
    </template>
    <template #body>
      <div ref="listContainerRef" class="request-list-scroll flex-1 min-h-0 overflow-y-auto py-2 pr-2">
        <div>
          <UAlert
            v-if="loadError"
            color="error"
            icon="i-lucide-circle-alert"
            :title="t('features.serviceRequests.messages.fetchError')"
            class="mb-4" variant="outline" />

          <UEmpty
            v-if="list.length === 0 && !pending"
            icon="i-lucide-ticket"
            :description="t('features.serviceRequests.messages.empty')"
            class="request-card ring-inset"
          />

          <div
            v-if="hasPreviousPage"
            ref="loadPreviousSentinelRef"
            aria-hidden="true"
            class="h-px"
          />

          <div v-if="loadingPreviousPage" class="pb-4 space-y-2">
            <USkeleton v-for="i in 2" :key="i" class="h-20 w-full" />
          </div>

          <div class="space-y-4">
            <UCard
              v-for="request in list"
              :key="request.id"
              class="request-card cursor-pointer ring-inset hover:bg-gray-50 dark:hover:bg-gray-900"
              @click="navigateTo(getDetailTo(request))"
            >
              <div class="flex justify-between items-start">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold">{{ request.title }}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                    {{ request.description }}
                  </p>
                  <div class="flex gap-2 mt-2 text-xs text-gray-500">
                    <span>{{ formatDate(request.createdAt) }}</span>
                    <span v-if="request.category">• {{ request.category }}</span>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-2 shrink-0">
                  <UButton
                    :to="getDetailTo(request)"
                    variant="outline"
                    size="sm"
                    class="shrink-0"
                    @click.stop
                  >
                    {{ t('common.view') }}
                  </UButton>
                  <UBadge :color="getStatusColor(request.status)" variant="solid" size="md">
                    {{ getStatusBadgeText(request.status) }}
                  </UBadge>
                  <UBadge :color="getPriorityColor(request.priority)" variant="soft" size="md">
                    {{ getPriorityBadgeText(request.priority) }}
                  </UBadge>
                </div>
              </div>
            </UCard>
          </div>

          <div v-if="pending && !loadingNextPage" class="py-4 space-y-2">
            <USkeleton v-for="i in 2" :key="i" class="h-20 w-full" />
          </div>

          <div
            v-if="hasNextPage"
            ref="loadMoreSentinelRef"
            aria-hidden="true"
            class="h-px"
          />

          <div v-if="loadingNextPage" class="py-4 space-y-2">
            <USkeleton v-for="i in 2" :key="i" class="h-20 w-full" />
          </div>

          <div
            v-if="pagination.total > 0 && !hasNextPage && !pending"
            class="end-of-list-bounce flex items-center justify-center gap-2 py-6 text-sm text-muted"
            role="status"
          >
            <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
            <span>{{ t('features.serviceRequests.messages.endOfList') }}</span>
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t border-default px-4 py-2 text-sm text-muted flex items-center justify-between gap-4">
        <span>
          {{ t('common.totalRecords') }}: <span class="font-medium text-highlighted">{{ pagination.total }}</span>
        </span>
        <UPagination
          v-if="pagination.pageCount > 1"
          :page="currentPage"
          :total="pagination.total"
          :items-per-page="pagination.pageSize"
          :disabled="pending"
          :to="getPageTo"
        />
      </div>

      <!-- Drawer (create / view / edit) -->
      <USlideover v-if="drawerOpen" v-model:open="drawerOpen" :title="drawerTitle" :ui="{ content: 'w-full sm:max-w-lg' }">
        <template #body>
          <div class="space-y-4">
            <template v-if="drawerMode === 'view' && selectedRequest">
              <CustomerRequestDetail
                :request-id="selectedRequest.id"
                :can-edit="canEdit"
                :can-delete="canDelete"
                @edit="drawerMode = 'edit'"
                @delete="showDeleteConfirm = true"
              />
            </template>

            <template v-else>
              <CustomerRequestForm
                :initial-data="editInitialData"
                :loading="mutationPending"
                @submit="drawerMode === 'create' ? handleCreate($event) : handleUpdate($event)"
                @cancel="closeDrawer"
              />

              <div v-if="drawerMode === 'edit' && canDelete" class="pt-2">
                <UButton
                  color="error"
                  variant="outline"
                  icon="i-lucide-trash-2"
                  :loading="mutationPending"
                  @click="showDeleteConfirm = true"
                >
                  {{ t('common.delete') }}
                </UButton>
              </div>
            </template>
          </div>

          <ConfirmationModal
            v-model:open="showDeleteConfirm"
            title="features.serviceRequests.delete"
            message="features.serviceRequests.confirmDelete"
            confirm-color="error"
            confirm-text="common.delete"
            @confirm="handleDelete"
          />
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
@keyframes end-of-list-bounce {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(-10px); }
  55% { transform: translateY(0); }
  75% { transform: translateY(-4px); }
}

.end-of-list-bounce {
  animation: end-of-list-bounce 650ms ease-out both;
}

.request-list-scroll {
  width: calc(100% + 1rem);
}

.request-card {
  margin-right: 0.5rem;
}

@media (min-width: 40rem) {
  .request-list-scroll {
    width: calc(100% + 1.5rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .end-of-list-bounce {
    animation: none;
  }
}
</style>
