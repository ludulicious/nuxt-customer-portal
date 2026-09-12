<script setup lang="ts">
import type { Page, Purchase } from '../../../shared/types'
import { formatMoney } from '../../../shared/money'

const { t, locale } = useI18n()
const api = useProducts()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const result = ref<Page<Purchase>>()
const files = ref<Record<string, Awaited<ReturnType<typeof api.files>>>>({})
const searchInput = ref(String(route.query.search || ''))
const pending = ref(false)
const error = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const type = computed(() => String(route.query.type || 'all'))
const access = computed(() => String(route.query.access || 'all'))
const sortBy = computed(() => String(route.query.sortBy || 'createdAt'))
const sortDir = computed<'asc' | 'desc'>(() => (route.query.sortDir === 'asc' ? 'asc' : 'desc'))
const filtered = computed(() => Boolean(route.query.search || type.value !== 'all' || access.value !== 'all'))
const source = (orderId: string, assetId: string) => `/api/products/purchases/${orderId}/files/${assetId}`

function updateQuery(key: string, value: string) {
  return router.replace({ query: { ...route.query, [key]: value || undefined, page: undefined } })
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

async function load() {
  controller?.abort()
  const active = new AbortController()
  controller = active
  pending.value = true
  error.value = ''
  try {
    const response = await api.purchases({ ...route.query, page: page.value }, active.signal)
    if (active.signal.aborted) {
      return
    }
    result.value = response
    files.value = {}
    await Promise.all(
      response.items.map(async (purchase) => {
        if (!purchase.access || !purchase.fileIds.length) {
          return
        }
        try {
          files.value[purchase.id] = await api.files(purchase.orderId)
        } catch {
          toast.add({ title: t('products.purchaseFilesFailed'), description: purchase.title, color: 'error' })
        }
      })
    )
  } catch {
    if (!active.signal.aborted) {
      error.value = t('products.purchasesFailed')
    }
  } finally {
    if (!active.signal.aborted) {
      pending.value = false
    }
  }
}
watch(
  () => [route.fullPath, locale.value],
  () => route.path === '/purchases' && load(),
  { immediate: true }
)
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  controller?.abort()
})
</script>

<template>
  <ProductsShell :title="t('products.purchases')" :subtitle="t('products.purchasesIntro')" icon="i-lucide-library">
    <template #actions>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        size="sm"
        :loading="pending"
        :aria-label="t('common.refresh')"
        @click="load"
      />
    </template>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <PortalListToolbar
      v-model:search="searchInput"
      :search-placeholder="t('products.purchasesSearch')"
      :filters="[
        {
          key: 'type',
          placeholder: t('products.purchaseType'),
          items: [
            { value: 'all', label: t('products.allPurchaseTypes') },
            { value: 'service', label: t('products.services') },
            { value: 'digital', label: t('products.digitalProducts') }
          ]
        },
        {
          key: 'access',
          placeholder: t('products.purchaseAccess'),
          items: [
            { value: 'all', label: t('products.allAccessStates') },
            { value: 'available', label: t('products.accessAvailable') },
            { value: 'revoked', label: t('products.accessRevoked') }
          ]
        }
      ]"
      :filter-values="{ type, access }"
      :sort-options="[
        { value: 'createdAt', label: t('products.purchaseSortDate') },
        { value: 'title', label: t('products.purchaseSortTitle') },
        { value: 'amount', label: t('products.purchaseSortAmount') }
      ]"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      @filter="toolbarFilter"
      @sort="updateQuery('sortBy', $event === 'createdAt' ? '' : $event)"
      @toggle-direction="updateQuery('sortDir', sortDir === 'asc' ? '' : 'asc')"
    />
    <div v-if="!result?.items.length && !pending && !error" class="py-10 text-center">
      <UIcon name="i-lucide-library" class="mx-auto size-10 text-muted" />
      <h2 class="mt-3 font-semibold">{{ t(filtered ? 'products.noMatchingPurchases' : 'products.noPurchases') }}</h2>
      <p v-if="filtered" class="mt-1 text-sm text-muted">{{ t('products.noMatchingPurchasesHelp') }}</p>
      <UButton v-if="filtered" class="mt-4" variant="outline" @click="clearFilters">
        {{ t('products.clearPurchaseFilters') }}
      </UButton>
    </div>
    <div class="grid gap-3">
      <UCard v-for="purchase in result?.items" :key="purchase.id">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <UAvatar :icon="purchase.type === 'service' ? 'i-lucide-calendar-check' : 'i-lucide-download'" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-semibold">{{ purchase.title }}</h2>
                <UBadge :color="purchase.access ? 'success' : 'error'" variant="subtle">
                  {{ t(purchase.access ? 'products.accessAvailable' : 'products.accessRevoked') }}
                </UBadge>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ formatMoney(purchase.amount, purchase.currency, locale) }} ·
                {{ new Date(purchase.createdAt).toLocaleDateString(locale) }}
              </p>
              <p class="mt-1 font-mono text-xs text-muted">{{ purchase.bookingReference }}</p>
            </div>
          </div>
          <UButton
            v-if="purchase.invoiceId"
            :to="`/invoices/${purchase.invoiceId}?from=orders`"
            variant="ghost"
            color="neutral"
            size="xs"
          >
            {{ t('products.invoice') }}
          </UButton>
        </div>
        <div class="mt-4 space-y-2 border-t border-default pt-3 text-sm">
          <p v-if="purchase.disputed">{{ t('products.disputed') }}</p>
          <p v-if="purchase.type === 'service'" class="text-muted">
            {{ t(purchase.fulfilled ? 'products.fulfilled' : 'products.awaitingFulfillment') }}
          </p>
          <p class="whitespace-pre-line">{{ purchase.nextSteps }}</p>
        </div>
        <div v-if="files[purchase.id]?.length" class="mt-4 grid gap-3 border-t border-default pt-3">
          <div v-for="file in files[purchase.id]" :key="file.id" class="space-y-2">
            <h3 class="text-sm font-medium">{{ file.name }}</h3>
            <audio
              v-if="file.content_type.startsWith('audio/')"
              :src="source(purchase.orderId, file.id)"
              controls
              preload="none"
              class="w-full"
            />
            <video
              v-else-if="file.content_type.startsWith('video/')"
              :src="source(purchase.orderId, file.id)"
              controls
              preload="none"
              class="w-full rounded-md"
            />
            <UButton
              :href="`${source(purchase.orderId, file.id)}?download=1`"
              external
              variant="outline"
              icon="i-lucide-download"
              size="sm"
            >
              {{ t('products.download') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
    <p v-if="pending" role="status" class="text-sm text-muted">{{ t('products.loading') }}</p>
    <template v-if="result" #footer>
      <span>{{ t('products.purchaseResults', result.pagination.totalItems) }}</span>
      <UPagination
        v-if="result.pagination.totalPages > 1"
        :page="page"
        :items-per-page="20"
        :total="result.pagination.totalItems"
        :disabled="pending"
        @update:page="router.replace({ query: { ...route.query, page: $event } })"
      />
    </template>
  </ProductsShell>
</template>
