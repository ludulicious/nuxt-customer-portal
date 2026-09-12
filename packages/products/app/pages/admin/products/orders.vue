<script setup lang="ts">
import type { Order, Page } from '../../../../shared/types'
import { formatMoney } from '../../../../shared/money'

const { t, locale } = useI18n()
const api = useProducts()
const route = useRoute()
const router = useRouter()
const result = ref<Page<Order>>()
const items = ref<Order[]>([])
const pending = ref(false)
const busyId = ref('')
const error = ref('')
const searchInput = ref(String(route.query.search || ''))
const listRoot = useTemplateRef('listRoot')
const topBoundary = useTemplateRef('topBoundary')
const bottomBoundary = useTemplateRef('bottomBoundary')
let observer: IntersectionObserver | undefined
let searchTimer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
let previousSignature = ''
let loaded = new Set<number>()

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const search = computed(() => String(route.query.search || ''))
const status = computed(() => String(route.query.status || 'all'))
const sortBy = computed(() => String(route.query.sortBy || 'createdAt'))
const sortDir = computed<'asc' | 'desc'>(() => (route.query.sortDir === 'asc' ? 'asc' : 'desc'))
const filtered = computed(() => Boolean(search.value || status.value !== 'all'))
const statusColor = (value: Order['status']) => {
  if (value === 'paid') {
    return 'success'
  }
  if (value === 'failed') {
    return 'error'
  }
  if (value === 'expired') {
    return 'warning'
  }
  return 'neutral'
}
const amount = (order: Order) =>
  formatMoney(
    order.total ?? order.lines.reduce((sum, line) => sum + line.unit_amount * line.quantity, 0),
    order.lines[0]!.snapshot.price.currency,
    locale.value
  )
const productNames = (order: Order) => order.lines.map((line) => line.snapshot.title).join(', ')

function updateQuery(key: string, value: string) {
  return router.replace({ query: { ...route.query, [key]: value || undefined, page: undefined, scroll: undefined } })
}
function toolbarFilter(key: string, value: string | undefined) {
  return updateQuery(key, value === 'all' ? '' : value || '')
}
function clearFilters() {
  clearTimeout(searchTimer)
  searchInput.value = ''
  return router.replace({ query: {} })
}
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => updateQuery('search', value.trim()), 300)
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

async function load(force = false) {
  controller?.abort()
  const active = new AbortController()
  controller = active
  pending.value = true
  error.value = ''
  const signature = JSON.stringify({ ...route.query, page: undefined, scroll: undefined })
  const same = signature === previousSignature && !force
  try {
    const response = await api.orders({ ...route.query, page: page.value }, active.signal)
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
          (prepend ? [...response.items, ...items.value] : [...items.value, ...response.items]).map((order) => [
            order.id,
            order
          ])
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
    if (route.path === '/admin/products/orders') {
      return load()
    }
  },
  { immediate: true }
)
onMounted(() => {
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

async function goToPage(value: number) {
  await router.replace({ query: { ...route.query, page: value, scroll: undefined } })
  listRoot.value?.closest('section')?.scrollTo({ top: 0, behavior: 'smooth' })
}
async function action(order: Order, name: 'retry' | 'fulfill') {
  busyId.value = `${order.id}:${name}`
  error.value = ''
  try {
    await api.orderAction(order.id, name)
    await load(true)
  } catch (cause) {
    const failure = cause as {
      data?: { message?: string; statusMessage?: string }
      message?: string
    }
    await load(true)
    error.value = failure.data?.message || failure.data?.statusMessage || failure.message || t('products.actionFailed')
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <ProductsShell :title="t('products.orders')" :subtitle="t('products.ordersIntro')" icon="i-lucide-receipt-text">
    <template #actions>
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
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <PortalListToolbar
      v-model:search="searchInput"
      :search-placeholder="t('products.ordersSearch')"
      :filters="[
        {
          key: 'status',
          placeholder: t('products.status'),
          items: [
            { value: 'all', label: t('products.allStatuses') },
            ...['pending', 'paid', 'failed', 'expired'].map((value) => ({ value, label: t(`products.${value}`) }))
          ]
        }
      ]"
      :filter-values="{ status }"
      :sort-options="[
        { value: 'createdAt', label: t('products.orderSortCreated') },
        { value: 'total', label: t('products.orderSortTotal') },
        { value: 'email', label: t('products.orderSortCustomer') },
        { value: 'bookingReference', label: t('products.bookingReference') }
      ]"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      @filter="toolbarFilter"
      @sort="updateQuery('sortBy', $event === 'createdAt' ? '' : $event)"
      @toggle-direction="updateQuery('sortDir', sortDir === 'asc' ? '' : 'asc')"
    />
    <div v-if="!items.length && !pending && !error" class="py-10 text-center">
      <UIcon name="i-lucide-receipt-text" class="mx-auto size-10 text-muted" />
      <h2 class="mt-3 font-semibold">{{ t(filtered ? 'products.noMatchingOrders' : 'products.noOrders') }}</h2>
      <p v-if="filtered" class="mt-1 text-sm text-muted">{{ t('products.noMatchingOrdersHelp') }}</p>
      <UButton v-if="filtered" class="mt-4" variant="outline" @click="clearFilters">{{
        t('products.clearOrderFilters')
      }}</UButton>
    </div>
    <div ref="listRoot">
      <div ref="topBoundary" class="h-px" aria-hidden="true" />
      <div class="grid gap-3">
        <UCard v-for="order in items" :key="order.id">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="flex min-w-0 items-start gap-3">
              <UAvatar icon="i-lucide-calendar-check" class="shrink-0" />
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="font-semibold">{{ productNames(order) }}</h2>
                  <UBadge :color="statusColor(order.status)" variant="subtle">{{
                    t(`products.${order.status}`)
                  }}</UBadge>
                </div>
                <p class="mt-1 font-mono text-xs text-muted">{{ order.booking_reference }}</p>
                <p class="mt-2 truncate text-sm">{{ order.email }}</p>
                <p class="mt-1 text-xs text-muted">{{ new Date(order.created_at).toLocaleString(locale) }}</p>
              </div>
            </div>
            <strong class="shrink-0 font-medium">{{ amount(order) }}</strong>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-default pt-3">
            <p
              v-if="order.lines.some((line) => line.snapshot.product.type === 'service')"
              class="mr-auto text-sm text-muted"
            >
              {{
                t(
                  order.lines.filter((line) => line.snapshot.product.type === 'service').every((line) => line.fulfilled)
                    ? 'products.fulfilled'
                    : 'products.awaitingFulfillment'
                )
              }}
            </p>
            <UButton v-if="order.invoice_id" to="/admin/invoices" variant="ghost" color="neutral" size="xs">{{
              t('products.invoice')
            }}</UButton>
            <UButton
              v-if="
                order.status === 'pending' ||
                (order.status === 'paid' &&
                  (!order.notified ||
                    order.processing !== 'complete' ||
                    (order.snapshot.storeMode === 'sandbox' &&
                      (!order.client_id || ((order.total || 0) !== 0 && !order.invoice_id)))))
              "
              variant="outline"
              size="xs"
              :loading="busyId === `${order.id}:retry`"
              @click.stop="action(order, 'retry')"
              >{{ t('products.retry') }}</UButton
            >
            <UButton
              v-if="
                order.status === 'paid' &&
                order.lines.some((line) => line.snapshot.product.type === 'service' && !line.fulfilled) &&
                !order.disputed &&
                order.refunded < (order.total || 0)
              "
              size="xs"
              :loading="busyId === `${order.id}:fulfill`"
              @click.stop="action(order, 'fulfill')"
              >{{ t('products.markFulfilled') }}</UButton
            >
          </div>
          <UAlert
            v-if="order.error"
            class="mt-3"
            color="error"
            variant="subtle"
            :title="t('products.processingFailed')"
            :description="order.error"
          />
        </UCard>
      </div>
      <div ref="bottomBoundary" class="h-px" aria-hidden="true" />
    </div>
    <p v-if="pending" role="status" class="text-sm text-muted">{{ t('products.loading') }}</p>
    <template v-if="result" #footer>
      <span>{{ t('products.results', result.pagination.totalItems) }}</span>
      <UPagination
        v-if="result.pagination.totalPages > 1"
        :page="page"
        :items-per-page="20"
        :total="result.pagination.totalItems"
        :disabled="pending"
        @update:page="goToPage"
      />
    </template>
  </ProductsShell>
</template>
