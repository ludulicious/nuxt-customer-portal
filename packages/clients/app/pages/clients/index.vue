<script setup lang="ts">
import type { ClientListResponse, GenericClientDto } from '@nuxt-customer-portal/clients/shared/types/client'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const api = useClients()
const runtimeConfig = useRuntimeConfig()
const defaultModules = (runtimeConfig.public.clients as { defaultModules?: string[] } | undefined)?.defaultModules ?? []
const search = ref(String(route.query.search ?? ''))
const status = ref(route.query.status === 'archived' ? 'archived' : route.query.status === 'all' ? 'all' : 'active')
const sortBy = ref(
  ['name', 'createdAt', 'status'].includes(String(route.query.sortBy)) ? String(route.query.sortBy) : 'name'
)
const sortDir = ref<'asc' | 'desc'>(route.query.sortDir === 'desc' ? 'desc' : 'asc')
const page = ref(Math.max(1, Number(route.query.page) || 1))
const result = ref<ClientListResponse | null>(null)
const pending = ref(false)
const busy = ref(false)
const formOpen = ref(false)
const listContainer = ref<HTMLElement | null>(null)
const listScrollTop = ref(0)
const scrollRestored = ref(false)
const clients = computed(() => result.value?.items ?? [])
const statusOptions = computed(() => [
  { label: t('features.clients.all'), value: 'all' },
  { label: t('features.clients.active'), value: 'active' },
  { label: t('features.clients.archived'), value: 'archived' }
])
const sortOptions = computed(() => [
  { label: t('features.clients.sortName'), value: 'name' },
  { label: t('features.clients.sortCreated'), value: 'createdAt' },
  { label: t('features.clients.sortStatus'), value: 'status' }
])

const routeQuery = () => ({
  ...(search.value.trim() ? { search: search.value.trim() } : {}),
  ...(status.value !== 'active' ? { status: status.value } : {}),
  ...(sortBy.value !== 'name' ? { sortBy: sortBy.value } : {}),
  ...(sortDir.value !== 'asc' ? { sortDir: sortDir.value } : {}),
  ...(page.value > 1 ? { page: String(page.value) } : {})
})
const requestQuery = () => ({
  ...routeQuery(),
  status: status.value === 'all' ? undefined : status.value
})

const listReturnPath = computed(() => {
  const query = new URLSearchParams({
    ...routeQuery(),
    ...(listScrollTop.value > 0 ? { scroll: String(Math.round(listScrollTop.value)) } : {})
  })
  const suffix = query.toString()
  return suffix ? `/clients?${suffix}` : '/clients'
})

const clientDetailTo = (client: GenericClientDto) => ({
  path: `/clients/${client.id}`,
  query: { returnTo: listReturnPath.value }
})

const load = async () => {
  pending.value = true
  try {
    result.value = await api.list({ ...requestQuery(), page: page.value, pageSize: 20 })
  } finally {
    pending.value = false
  }
}

const restoreScroll = async () => {
  if (!import.meta.client || scrollRestored.value) {
    return
  }
  const value = Number(route.query.scroll)
  if (!Number.isFinite(value) || value <= 0) {
    return
  }
  await nextTick()
  if (!listContainer.value) {
    return
  }
  listContainer.value.scrollTop = value
  scrollRestored.value = true
}

const syncAndLoad = async (resetPage = false) => {
  if (resetPage) {
    page.value = 1
  }
  scrollRestored.value = false
  await router.replace({ path: route.path, query: routeQuery() })
  await load()
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void syncAndLoad(true)
  }, 300)
})
watch([status, sortBy, sortDir], () => {
  void syncAndLoad(true)
})
watch(pending, (value) => {
  if (!value) {
    void restoreScroll()
  }
})
onScopeDispose(() => clearTimeout(searchTimer))
onKeyStroke('Escape', () => {
  formOpen.value = false
})

const save = async (input: Record<string, unknown>) => {
  busy.value = true
  try {
    const client = await api.create({ ...input, moduleIds: defaultModules })
    formOpen.value = false
    await load()
    toast.add({ title: t('features.clients.saved'), color: 'success' })
    await navigateTo(clientDetailTo(client))
  } catch (error) {
    toast.add({ title: t('features.clients.saveFailed'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}

const goToPage = async (value: number) => {
  page.value = value
  listScrollTop.value = 0
  await syncAndLoad()
  listContainer.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

await load()
onMounted(() => {
  void restoreScroll()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      ref="listContainer"
      class="min-h-0 flex-1 overflow-y-auto"
      @scroll="listScrollTop = listContainer?.scrollTop ?? 0"
    >
      <div class="mx-auto flex max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header class="flex items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
          <div class="flex min-w-0 gap-3">
            <UIcon name="i-lucide-building-2" class="mt-1 size-6 shrink-0 text-primary" />
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold">{{ t('features.clients.title') }}</h1>
              <p class="hidden text-sm text-muted sm:block">{{ t('features.clients.description') }}</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <UButton
              v-if="clients.length && !formOpen"
              class="rounded-full sm:hidden"
              icon="i-lucide-plus"
              :aria-label="t('features.clients.new')"
              @click="formOpen = true"
            />
            <UButton
              v-if="clients.length && !formOpen"
              class="hidden sm:inline-flex"
              size="sm"
              variant="outline"
              icon="i-lucide-plus"
              @click="formOpen = true"
            >
              {{ t('features.clients.new') }}
            </UButton>
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="pending"
              :aria-label="t('common.refresh')"
              @click="load"
            />
          </div>
        </header>

        <PortalListToolbar
          v-model:search="search"
          :search-placeholder="t('features.clients.search')"
          :filters="[{ key: 'status', placeholder: t('features.clients.status'), items: statusOptions }]"
          :filter-values="{ status }"
          :sort-options="sortOptions"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          @filter="(_key, value) => (status = value || 'all')"
          @sort="sortBy = $event"
          @toggle-direction="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
        />

        <ClientsClientForm v-if="formOpen" :busy="busy" @submit="save" @cancel="formOpen = false" />

        <UCard v-if="!clients.length && !pending && !formOpen" variant="subtle">
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon name="i-lucide-building-2" class="size-10 text-muted" />
            <div>
              <h2 class="font-semibold">{{ t('features.clients.emptyTitle') }}</h2>
              <p class="text-sm text-muted">{{ t('features.clients.emptyDescription') }}</p>
            </div>
            <UButton icon="i-lucide-plus" @click="formOpen = true">{{ t('features.clients.createFirst') }}</UButton>
          </div>
        </UCard>

        <div v-else class="grid gap-3">
          <UCard
            v-for="client in clients"
            :key="client.id"
            class="transition-colors hover:ring-1 hover:ring-primary/50"
          >
            <div class="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-3">
              <NuxtLink
                :to="clientDetailTo(client)"
                class="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                <UAvatar :src="client.logo ?? undefined" :alt="client.name" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="truncate font-semibold">{{ client.name }}</p>
                    <UBadge :color="client.archivedAt ? 'neutral' : 'success'" variant="subtle">{{
                      t(client.archivedAt ? 'features.clients.archived' : 'features.clients.active')
                    }}</UBadge>
                  </div>
                  <p class="mt-1 truncate text-sm text-muted">{{ client.officialName }} · {{ client.slug }}</p>
                </div>
              </NuxtLink>
              <NuxtLink
                :to="clientDetailTo(client)"
                :aria-label="t('features.clients.openClient', { name: client.name })"
                class="grid size-11 place-items-center justify-self-end rounded focus-visible:outline-2 focus-visible:outline-primary"
              >
                <UIcon name="i-lucide-chevron-right" class="size-5 text-muted" />
              </NuxtLink>
            </div>
          </UCard>
        </div>
      </div>
    </div>
    <footer
      v-if="result"
      class="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-default px-4 pt-3 text-sm text-muted sm:px-6 lg:px-8"
    >
      <span>{{ t('features.clients.resultCount', result.pagination.totalItems) }}</span>
      <UPagination
        v-if="result.pagination.totalPages > 1"
        :page="page"
        :total="result.pagination.totalItems"
        :items-per-page="20"
        @update:page="goToPage"
      />
    </footer>
  </div>
</template>
