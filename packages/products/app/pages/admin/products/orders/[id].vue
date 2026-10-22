<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { formatMoney } from '../../../../../shared/money'
import { canFulfillOrderLine } from '../../../../../shared/fulfillment'

definePageMeta({ key: (route) => route.path })
const route = useRoute()
const { t, locale } = useI18n()
const api = useProducts()
const toast = useToast()
const { copy } = useClipboard()
const id = String(route.params.id)
const { data, pending, error, refresh } = await useAsyncData(`admin-order-${id}`, () => api.order(id))
const order = computed(() => data.value?.order)
const busy = ref('')
const returnTo = computed(() => {
  const value = route.query.ordersReturnTo
  return typeof value === 'string' && /^\/admin\/products\/orders(?:\?|$)/.test(value)
    ? value
    : '/admin/products/orders'
})
const customerName = computed(() => {
  const billing = order.value?.snapshot.billing
  return billing?.name || [billing?.firstName, billing?.lastName].filter(Boolean).join(' ') || '—'
})
const money = (amount: number | null | undefined) =>
  amount === null || amount === undefined ? '—' : formatMoney(amount, data.value!.purchase.currency, locale.value)
const canRetry = computed(() => {
  const value = order.value
  return (
    value &&
    (value.status === 'pending' ||
      (['paid', 'accepted'].includes(value.status) &&
        (!value.notified ||
          value.processing !== 'complete' ||
          (value.snapshot.storeMode === 'sandbox' &&
            (!value.client_id || ((value.total || 0) !== 0 && !value.invoice_id))))))
  )
})
async function copyLink() {
  busy.value = 'link'
  try {
    await copy((await api.orderLink(id)).url)
    toast.add({ title: t('products.orderLinkCopied'), color: 'success' })
  } catch {
    toast.add({ title: t('products.orderLinkFailed'), color: 'error' })
  } finally {
    busy.value = ''
  }
}
async function action(name: 'retry' | 'fulfill') {
  busy.value = name
  try {
    await api.orderAction(id, name)
  } catch (cause) {
    const failure = cause as { data?: { message?: string }; message?: string }
    toast.add({ title: failure.data?.message || failure.message || t('products.actionFailed'), color: 'error' })
  } finally {
    await refresh()
    busy.value = ''
  }
}
useHead({ title: () => order.value?.booking_reference || t('products.adminOrder.title') })
</script>

<template>
  <ProductsShell
    :title="order?.booking_reference || t('products.adminOrder.title')"
    :subtitle="t('products.adminOrder.title')"
    icon="i-lucide-receipt-text"
  >
    <template #back>
      <UButton :to="returnTo" variant="link" color="neutral" icon="i-lucide-arrow-left" class="w-fit px-0">
        {{ t('products.backToOrders') }}
      </UButton>
    </template>
    <template #actions>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        :loading="pending"
        :aria-label="t('common.refresh')"
        @click="refresh()"
      />
    </template>
    <p v-if="pending && !data" role="status">{{ t('products.loading') }}</p>
    <UAlert v-else-if="error" color="error" :title="t('products.loadFailed')" />
    <div v-else-if="data && order" class="space-y-4">
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold">{{ t('products.adminOrder.summary') }}</h2>
            <ProductsTestOrderBadge v-if="order.snapshot.storeMode === 'sandbox'" />
            <UBadge variant="subtle" :color="order.status === 'paid' ? 'success' : 'neutral'">{{
              t(`products.${order.status}`)
            }}</UBadge>
          </div>
        </template>
        <dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt class="text-muted">{{ t('products.adminOrder.customer') }}</dt>
            <dd class="mt-1 font-medium">{{ customerName }}</dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('products.adminOrder.email') }}</dt>
            <dd class="mt-1 break-words">{{ order.email }}</dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('products.billingClient') }}</dt>
            <dd class="mt-1">
              <NuxtLink
                v-if="data.client"
                :to="`/clients/${encodeURIComponent(data.client.id)}`"
                class="text-primary hover:underline"
                >{{ data.client.name }}</NuxtLink
              >
              <span v-else>{{ order.snapshot.billing.company || t('products.adminOrder.noClient') }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('products.orderSortCreated') }}</dt>
            <dd class="mt-1">{{ new Date(order.created_at).toLocaleString(locale) }}</dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('products.orderSortTotal') }}</dt>
            <dd class="mt-1 font-medium">{{ money(order.total) }}</dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('products.paymentMethod') }}</dt>
            <dd class="mt-1">
              {{ order.snapshot.paymentMethod ? t(`products.adminOrder.${order.snapshot.paymentMethod}`) : '—' }}
            </dd>
          </div>
          <div v-if="order.paymentStatus">
            <dt class="text-muted">{{ t('products.status') }}</dt>
            <dd class="mt-1">{{ t(`products.payment${order.paymentStatus}`) }}</dd>
          </div>
          <div v-if="order.outstandingAmount !== undefined">
            <dt class="text-muted">{{ t('products.adminOrder.outstanding') }}</dt>
            <dd class="mt-1">{{ money(order.outstandingAmount) }}</dd>
          </div>
          <div v-if="order.refunded">
            <dt class="text-muted">{{ t('products.refunded') }}</dt>
            <dd class="mt-1">{{ money(order.refunded) }}</dd>
          </div>
        </dl>
        <div class="mt-5 flex flex-wrap gap-2 border-t border-default pt-4">
          <UButton
            icon="i-lucide-link"
            variant="outline"
            :disabled="!!busy"
            :loading="busy === 'link'"
            @click="copyLink"
            >{{ t('products.copyClientOrderLink') }}</UButton
          >
          <UButton
            :to="
              order.invoice_id
                ? {
                    path: `/admin/invoices/${encodeURIComponent(order.invoice_id)}`,
                    query: { ordersReturnTo: returnTo }
                  }
                : undefined
            "
            :disabled="!order.invoice_id"
            icon="i-lucide-file-text"
            variant="outline"
            >{{ t('products.invoice') }}</UButton
          >
          <UButton
            v-if="canRetry"
            variant="outline"
            :disabled="!!busy"
            :loading="busy === 'retry'"
            @click="action('retry')"
            >{{ t('products.retry') }}</UButton
          >
          <UButton
            v-if="order.lines.some((line) => canFulfillOrderLine(order!, line))"
            :disabled="!!busy"
            :loading="busy === 'fulfill'"
            @click="action('fulfill')"
            >{{ t('products.markFulfilled') }}</UButton
          >
        </div>
      </UCard>
      <UAlert v-if="order.error" color="error" :title="t('products.processingFailed')" :description="order.error" />
      <UAlert v-if="order.disputed" color="warning" :title="t('products.disputed')" />
      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t('products.adminOrder.clientDetails') }}</h2>
        </template>
        <ProductsPublicOrder :order="data.purchase" :copy="data.purchase.copy" embedded @refresh="refresh()" />
      </UCard>
    </div>
  </ProductsShell>
</template>
