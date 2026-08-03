<script setup lang="ts">
import type { AdminUsersResponse, AdminUserResponse, ApiError } from '#types'

const { isAdmin } = storeToRefs(useUserStore())
const { t } = useI18n()
const isMobile = useBreakpoints({ mobile: 768 }).smaller('mobile')

useSeoMeta({
  title: () => t('admin.user.list.title')
})

if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: t('admin.errors.accessRequired') })
}

const loading = ref(true)
const error = ref('')
const users = ref<AdminUserResponse[]>([])
const searchQuery = ref('')

const loadUsers = async () => {
  try {
    loading.value = true
    const params: Record<string, string> = {}
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }
    users.value = await $fetch<AdminUsersResponse>('/api/admin/users', {
      query: params
    })
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || t('admin.errors.failedToLoadUsers')
  } finally {
    loading.value = false
  }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    loadUsers()
  }, 300)
}

watch(searchQuery, (newValue) => {
  if (!newValue || newValue.trim() === '') {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    loadUsers()
  } else {
    handleSearch()
  }
})

onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})

await loadUsers()

const canCreate = ref(true)
const startCreate = () => {
  console.log('startCreate')
}
const showFiltersModal = ref(false)
const showSortModal = ref(false)
const sortBy = ref<'name' | 'email' | 'createdAt'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')
const currentSortLabel = computed(() => {
  return sortOptions.value.find(option => option.value === sortBy.value)?.label || t('common.sort')
})
const sortOptions = computed(() => [
  { label: t('admin.user.list.name'), value: 'name' as const },
  { label: t('admin.user.list.email'), value: 'email' as const },
  { label: t('admin.user.list.created'), value: 'createdAt' as const }
])
const sortDropdownItems = computed(() => {
  return sortOptions.value.map(option => ({
    label: option.label,
    icon: sortBy.value === option.value ? 'i-lucide-check' : undefined,
    onSelect: () => {
      sortBy.value = option.value
    }
  }))
})
const toggleSortDir = () => {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

</script>

<template>
  <div>
    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :ui="{ right: 'gap-3' }" :toggle="false">
          <template #leading>
            <UIcon name="i-lucide-users" class="size-6 shrink-0" />
            <span class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.user.list.title') }}
            </span>
          </template>

          <template #right>
            <div class="flex gap-2 w-full sm:w-auto">
              <UButton icon="i-lucide-plus" color="primary" class="flex-1 sm:flex-none" :title="t('admin.user.list.createButton')"
                :disabled="!canCreate" @click="startCreate" />
              <UButton icon="i-lucide-refresh-cw" variant="outline" :loading="loading" class="flex-1 sm:flex-none"
                :title="t('common.refresh')" @click="loadUsers" />
            </div>
          </template>
        </UDashboardNavbar>

        <UDashboardToolbar>
          <template #left>
            <div class="flex items-center gap-2 w-full">
              <UInput v-model="searchQuery" :placeholder="t('common.searchPlaceholder')" icon="i-lucide-search"
                :loading="loading" class="flex-1 max-w-md" clearable />
            </div>
          </template>
          <template #right>
            <div class="flex items-center gap-2">
              <UButton v-if="isMobile" icon="i-lucide-filter" variant="outline" @click="showFiltersModal = true">
                Filters
              </UButton>
              <UButton v-if="isMobile" icon="i-lucide-arrow-down-up" variant="outline" :title="t('common.sort')"
                @click="showSortModal = true">
                {{ t('common.sort') }}
              </UButton>

              <UDropdownMenu v-if="!isMobile" :items="sortDropdownItems"
                :content="{ align: 'end', collisionPadding: 12 }">
                <UButton icon="i-lucide-arrow-down-up" variant="outline" class="w-48 justify-between">
                  <span class="truncate">{{ currentSortLabel }}</span>
                  <UIcon name="i-lucide-chevron-down" class="size-4 opacity-60" />
                </UButton>
              </UDropdownMenu>
              <UButton v-if="!isMobile"
                :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'"
                variant="outline" :title="sortDir === 'asc' ? t('common.ascending') : t('common.descending')"
                @click="toggleSortDir" />
            </div>
          </template>
        </UDashboardToolbar>

        <!-- Mobile Filters Modal -->
        <UModal v-model:open="showFiltersModal" title="Filters" :ui="{ content: 'w-full sm:max-w-md' }">
          <template #body>
            <div class="space-y-4">
              <p>ShowFiltersModal</p>
            </div>
          </template>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="outline" @click="showFiltersModal = false">
                {{ t('common.close') }}
              </UButton>
            </div>
          </template>
        </UModal>

        <!-- Mobile Sort Modal -->
        <UModal v-model:open="showSortModal" :title="t('common.sort')" :ui="{ content: 'w-full sm:max-w-md' }">
          <template #body>
            <div class="space-y-4">
              <UFormField :label="t('common.sortBy')">
                <USelect v-model="sortBy" class="w-full" :items="sortOptions" :placeholder="t('common.sortBy')" />
              </UFormField>

              <UFormField :label="t('common.direction')">
                <div class="flex gap-2">
                  <UButton class="flex-1" :variant="sortDir === 'asc' ? 'solid' : 'outline'"
                    :icon="sortDir === 'asc' ? 'i-lucide-check' : undefined" @click="sortDir = 'asc'">
                    {{ t('common.ascending') }}
                  </UButton>
                  <UButton class="flex-1" :variant="sortDir === 'desc' ? 'solid' : 'outline'"
                    :icon="sortDir === 'desc' ? 'i-lucide-check' : undefined" @click="sortDir = 'desc'">
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
        <div class="flex-1 min-h-0 overflow-y-auto p-2">
          <UAlert v-if="error" color="error" :title="error" variant="outline" />

          <AdminUsersTable v-else :users="users" :loading="loading" @refresh="loadUsers" />
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
