<script setup lang="ts">
import type { Product, Page, ProductCategory } from '../../../../shared/types'
import { formatMoney } from '../../../../shared/money'

const { t, locale } = useI18n(),
  api = useProducts(),
  route = useRoute(),
  router = useRouter()
const categories = ref<ProductCategory[]>([])
const searchInput = ref(String(route.query.search || ''))
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => filter('search', value.trim()), 300)
})
watch(
  () => route.query.search,
  (value) => {
    if (String(value || '') !== searchInput.value.trim()) {
      clearTimeout(searchTimer)
      searchInput.value = String(value || '')
    }
  }
)
const result = ref<Page<Product>>(),
  items = ref<Product[]>([]),
  pending = ref(false),
  error = ref('')
const listRoot = useTemplateRef('listRoot'),
  topBoundary = useTemplateRef('topBoundary'),
  bottomBoundary = useTemplateRef('bottomBoundary')
let observer: IntersectionObserver | undefined
let restoredScroll = false
const page = computed(() => Math.max(1, Number(route.query.page) || 1)),
  search = computed({ get: () => String(route.query.search || ''), set: (v) => filter('search', v) }),
  status = computed({
    get: () => String(route.query.status || 'all'),
    set: (v) => filter('status', v === 'all' ? '' : v)
  }),
  kind = computed({ get: () => String(route.query.type || 'all'), set: (v) => filter('type', v === 'all' ? '' : v) }),
  category = computed({ get: () => String(route.query.category || ''), set: (v) => filter('category', v) })
const sortBy = computed({ get: () => String(route.query.sortBy || 'updatedAt'), set: (v) => filter('sortBy', v) }),
  sortDir = computed<'asc' | 'desc'>({
    get: () => (route.query.sortDir === 'asc' ? 'asc' : 'desc'),
    set: (v) => filter('sortDir', v)
  })
const options = (values: string[]) => values.map((value) => ({ value, label: t(`products.${value}`) }))
const filtered = computed(() => !!(search.value || status.value !== 'all' || kind.value !== 'all' || category.value))
const title = (product: Product) =>
  product.content[locale.value === 'nl' ? 'nl' : 'en'].title || product.content.en.title || product.content.nl.title
function toolbarFilter(key: string, value: string | undefined) {
  filter(
    key,
    key === 'category'
      ? value === 'all'
        ? ''
        : (value || '').slice('category:'.length)
      : value === 'all'
        ? ''
        : value || ''
  )
}
function clearFilters() {
  clearTimeout(searchTimer)
  searchInput.value = ''
  return router.replace({ query: {} })
}
function filter(key: string, value: string) {
  router.replace({ query: { ...route.query, [key]: value || undefined, page: undefined, scroll: undefined } })
}
let controller: AbortController | undefined,
  previousSignature = '',
  loaded = new Set<number>()
async function load(force = false) {
  controller?.abort()
  const active = new AbortController()
  controller = active
  pending.value = true
  error.value = ''
  const signature = JSON.stringify({ ...route.query, page: undefined }),
    same = signature === previousSignature && !force
  try {
    const response = await api.list({ ...route.query, locale: locale.value, page: page.value }, active.signal)
    if (active.signal.aborted) {
      return
    }
    const scroll = listRoot.value?.closest('section')
    const height = scroll?.scrollHeight ?? 0
    const prepend = same && loaded.size > 0 && page.value < Math.min(...loaded)
    result.value = response
    if (same && !loaded.has(page.value) && (loaded.has(page.value - 1) || loaded.has(page.value + 1))) {
      items.value = Array.from(
        new Map(
          (prepend ? [...response.items, ...items.value] : [...items.value, ...response.items]).map((p) => [p.id, p])
        ).values()
      )
    } else {
      items.value = response.items
      loaded = new Set()
    }
    loaded.add(page.value)
    previousSignature = signature
    await nextTick()
    if (prepend && scroll) {
      scroll.scrollTop += scroll.scrollHeight - height
    }
    if (!restoredScroll && scroll) {
      scroll.scrollTop = Math.max(0, Number(route.query.scroll) || 0)
      restoredScroll = true
    }
  } catch {
    if (!active.signal.aborted) {
      error.value = t('products.loadFailed')
    }
  } finally {
    if (!active.signal.aborted) {
      pending.value = false
    }
  }
}
watch(
  () => [route.fullPath, locale.value],
  () => {
    if (route.path === '/admin/products') {
      return load()
    }
  },
  { immediate: true }
)
onMounted(() => {
  api
    .categories()
    .then((value) => {
      categories.value = value
    })
    .catch(() => {
      error.value = t('products.loadFailed')
    })
  observer = new IntersectionObserver(
    (entries) => {
      if (pending.value || !loaded.size || !result.value) {
        return
      }
      const entry = entries.find((item) => item.isIntersecting)
      if (!entry) {
        return
      }
      const next = entry.target === topBoundary.value ? Math.min(...loaded) - 1 : Math.max(...loaded) + 1
      if (next > 0 && next <= result.value.pagination.totalPages && !loaded.has(next)) {
        router.replace({ query: { ...route.query, page: next } })
      }
    },
    { root: listRoot.value?.closest('section'), rootMargin: '40px' }
  )
  if (topBoundary.value) {
    observer.observe(topBoundary.value)
  }
  if (bottomBoundary.value) {
    observer.observe(bottomBoundary.value)
  }
})
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  controller?.abort()
  observer?.disconnect()
})
const returnQuery = () => ({
  ...route.query,
  scroll: String(Math.round(listRoot.value?.closest('section')?.scrollTop || 0))
})
async function goToPage(value: number) {
  await router.replace({ query: { ...route.query, page: value, scroll: undefined } })
  listRoot.value?.closest('section')?.scrollTo({ top: 0, behavior: 'smooth' })
}
function startCreate() {
  return navigateTo({ path: '/admin/products/new', query: returnQuery() })
}
function edit(product: Product) {
  return navigateTo({ path: `/admin/products/${product.id}`, query: returnQuery() })
}
</script>

<template>
  <ProductsShell :title="t('products.catalog')" :subtitle="t('products.catalogIntro')"
    ><template #actions>
      <UButton
        v-if="items.length || filtered"
        class="rounded-full sm:hidden"
        icon="i-lucide-plus"
        :aria-label="t('products.new')"
        @click="startCreate"
      />
      <UButton
        v-if="items.length || filtered"
        class="hidden sm:inline-flex"
        icon="i-lucide-plus"
        variant="outline"
        size="sm"
        @click="startCreate"
        >{{ t('products.new') }}</UButton
      >
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        size="sm"
        :loading="pending"
        :aria-label="t('common.refresh')"
        @click="load(true)"
      />
    </template>
    <UAlert v-if="error" color="error" :title="error" />
    <PortalListToolbar
      v-model:search="searchInput"
      :search-placeholder="t('products.search')"
      :filters="[
        {
          key: 'status',
          placeholder: t('products.status'),
          items: [{ value: 'all', label: t('products.allStatuses') }, ...options(['draft', 'published', 'archived'])]
        },
        {
          key: 'type',
          placeholder: t('products.type'),
          items: [{ value: 'all', label: t('products.allTypes') }, ...options(['digital', 'service'])]
        },
        {
          key: 'category',
          placeholder: t('products.category'),
          items: [
            { value: 'all', label: t('products.allCategories') },
            ...categories.map((c) => ({ value: `category:${c.name}`, label: c.name }))
          ]
        }
      ]"
      :filter-values="{ status, type: kind, category: category ? `category:${category}` : 'all' }"
      :sort-options="options(['updatedAt', 'title'])"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      @filter="toolbarFilter"
      @sort="sortBy = $event"
      @toggle-direction="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
    />
    <ProductsEmptyState
      v-if="!items.length && !pending && !error"
      :filtered="filtered"
      @create="startCreate"
      @reset="clearFilters"
    />
    <div ref="listRoot">
      <div ref="topBoundary" class="h-px" aria-hidden="true" />
      <div class="grid gap-3">
        <template v-for="product in items" :key="product.id"
          ><UCard
            class="cursor-pointer transition-colors hover:ring-1 hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
            role="button"
            tabindex="0"
            :aria-label="t('products.openProduct', { name: title(product) })"
            @click="edit(product)"
            @keydown.enter.prevent="edit(product)"
            @keydown.space.prevent="edit(product)"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <UAvatar
                  :icon="product.type === 'digital' ? 'i-lucide-file-down' : 'i-lucide-calendar-check'"
                  class="shrink-0"
                />
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="truncate font-semibold">{{ title(product) }}</h2>
                    <UBadge :color="product.status === 'published' ? 'success' : 'neutral'" variant="subtle">{{
                      t(`products.${product.status}`)
                    }}</UBadge>
                  </div>
                  <p class="mt-1 text-sm text-muted">
                    {{ t(`products.${product.type}`) }}<span v-if="product.category"> · {{ product.category }}</span>
                  </p>
                  <p class="mt-1 text-sm">
                    {{
                      product.isFree
                        ? t('products.freeProduct')
                        : product.prices.map((p) => formatMoney(p.amount, p.currency, locale)).join(' · ')
                    }}
                  </p>
                </div>
              </div>
              <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted" aria-hidden="true" />
            </div>
          </UCard>
        </template>
      </div>
      <div ref="bottomBoundary" class="h-px" aria-hidden="true" />
    </div>
    <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    <template v-if="result" #footer>
      <span>{{ t('products.results', result.pagination.totalItems) }}</span>
      <UPagination
        v-if="result.pagination.totalPages > 1"
        :page="page"
        :items-per-page="20"
        :total="result.pagination.totalItems"
        @update:page="goToPage"
      />
    </template>
  </ProductsShell>
</template>
