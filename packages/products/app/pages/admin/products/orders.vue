<script setup lang="ts">
import type { Page, Order } from '../../../../shared/types'
import { formatMoney } from '../../../../shared/money'

const { t, locale } = useI18n(),
  api = useProducts(),
  route = useRoute(),
  router = useRouter(),
  result = ref<Page<Order>>(),
  error = ref(''),
  busy = ref(false)
const page = computed(() => Math.max(1, Number(route.query.page) || 1)),
  search = computed({
    get: () => String(route.query.search || ''),
    set: (value) => router.replace({ query: { ...route.query, search: value || undefined, page: undefined } })
  }),
  status = computed({
    get: () => String(route.query.status || 'all'),
    set: (value) => router.replace({ query: { ...route.query, status: value, page: undefined } })
  })
let version = 0
async function load() {
  const current = ++version
  try {
    const response = await api.orders({ ...route.query, page: page.value })
    if (current === version) {
      result.value = response
    }
  } catch {
    error.value = t('products.loadFailed')
  }
}
watch(() => route.fullPath, load, { immediate: true })
async function action(id: string, name: 'retry' | 'fulfill') {
  busy.value = true
  error.value = ''
  try {
    await api.orderAction(id, name)
    await load()
  } catch {
    error.value = t('products.actionFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ProductsShell :title="t('products.orders')" :subtitle="t('products.ordersIntro')"
    ><UAlert v-if="error" color="error" :title="error" />
    <div class="flex gap-3">
      <UInput v-model="search" :placeholder="t('products.search')" :aria-label="t('products.search')" /><USelect
        v-model="status"
        :items="
          ['all', 'pending', 'paid', 'failed', 'expired'].map((value) => ({ value, label: t(`products.${value}`) }))
        "
        :aria-label="t('products.status')"
      />
    </div>
    <div v-if="!result?.items.length" class="rounded-lg border p-8">{{ t('products.noOrders') }}</div>
    <article v-for="order in result?.items" :key="order.id" class="space-y-3 rounded-lg border p-4">
      <div class="flex justify-between gap-3">
        <div>
          <h2 class="font-medium">{{ order.lines.map((line) => line.snapshot.title).join(', ') }}</h2>
          <p>{{ order.email }}</p>
          <p class="text-sm text-muted">
            {{ new Date(order.created_at).toLocaleString(locale) }} · {{ t(`products.${order.status}`) }}
          </p>
        </div>
        <span>{{
          formatMoney(
            order.total ?? order.lines.reduce((sum, line) => sum + line.unit_amount * line.quantity, 0),
            order.lines[0]!.snapshot.price.currency,
            locale
          )
        }}</span>
      </div>
      <p v-if="order.refunded">
        {{ t('products.refunded') }}: {{ formatMoney(order.refunded, order.lines[0]!.snapshot.price.currency, locale) }}
      </p>
      <p v-if="order.disputed">{{ t('products.disputed') }}</p>
      <p v-if="order.lines.some((line) => line.snapshot.product.type === 'service')">
        {{
          t(
            order.lines.filter((line) => line.snapshot.product.type === 'service').every((line) => line.fulfilled)
              ? 'products.fulfilled'
              : 'products.awaitingFulfillment'
          )
        }}
      </p>
      <UAlert v-if="order.error" color="error" :title="t('products.processingFailed')" :description="order.error" />
      <div class="flex flex-wrap gap-2">
        <UButton v-if="order.invoice_id" :to="`/admin/invoices`" variant="outline">{{ t('products.invoice') }}</UButton
        ><UButton variant="outline" :loading="busy" @click="action(order.id, 'retry')">{{
          t('products.retry')
        }}</UButton
        ><UButton
          v-if="
            order.status === 'paid' &&
            order.lines.some((line) => line.snapshot.product.type === 'service' && !line.fulfilled) &&
            !order.disputed &&
            order.refunded < (order.total || 0)
          "
          :loading="busy"
          @click="action(order.id, 'fulfill')"
          >{{ t('products.markFulfilled') }}</UButton
        >
      </div>
    </article>
    <UPagination
      v-if="result"
      :page="page"
      :total="result.pagination.totalItems"
      :items-per-page="20"
      @update:page="router.replace({ query: { ...route.query, page: $event } })"
  /></ProductsShell>
</template>
