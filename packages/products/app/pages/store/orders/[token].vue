<script setup lang="ts">
import type { PublicOrderDetails } from '../../../../shared/public-order'
import { defaultCheckoutAppearance } from '../../../../shared/checkout-appearance'
import { formatMoney } from '../../../../shared/money'

definePageMeta({ public: true, layout: 'store', key: (route) => route.path })
const route = useRoute()
const { t, locale, setLocale } = useI18n()
const token = String(route.params.token)
const {
  data: order,
  error,
  status,
  refresh
} = await useFetch<PublicOrderDetails>(`/api/store/purchases/${encodeURIComponent(token)}/details`)
if (order.value && locale.value !== order.value.locale) {
  await setLocale(order.value.locale)
}
useHead({
  title: () => t('products.publicOrderTitle'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow, noarchive' },
    { name: 'referrer', content: 'no-referrer' }
  ]
})
const appearance = computed(() => order.value?.appearance || defaultCheckoutAppearance())
const themeStyle = computed(() => ({
  '--ui-bg': appearance.value.surfaceColor,
  '--ui-bg-elevated': appearance.value.paperColor,
  '--ui-bg-accented': appearance.value.paperColor,
  '--ui-bg-muted': appearance.value.paperColor,
  '--ui-border': appearance.value.borderColor,
  '--ui-border-muted': appearance.value.borderColor,
  '--ui-text': appearance.value.inkColor,
  '--ui-text-highlighted': appearance.value.inkColor,
  '--ui-text-muted': appearance.value.mutedColor,
  '--ui-primary': appearance.value.actionColor,
  backgroundColor: appearance.value.paperColor,
  color: appearance.value.inkColor,
  fontFamily: appearance.value.bodyFontFamily,
  '--order-surface': appearance.value.surfaceColor,
  '--order-border': appearance.value.borderColor,
  '--order-display': appearance.value.displayColor,
  '--order-muted': appearance.value.mutedColor,
  '--order-radius': `${appearance.value.radius}px`,
  '--order-display-font': appearance.value.displayFontFamily
}))
const unavailable = computed(() => !!error.value && [400, 404].includes(error.value.statusCode || 0))
const waiting = computed(() => order.value?.status === 'pending')
const revoked = computed(
  () => !!order.value && !order.value.access && ['paid', 'accepted'].includes(order.value.status)
)
</script>

<template>
  <main class="public-order min-h-screen px-4 py-8 sm:py-12" :style="themeStyle">
    <div class="mx-auto max-w-4xl space-y-6">
      <header class="flex items-center gap-3">
        <img
          v-if="appearance.logoUrl"
          :src="appearance.logoUrl"
          :alt="appearance.hostName"
          referrerpolicy="no-referrer"
          class="max-h-16 max-w-48 object-contain"
        />
        <span v-else-if="appearance.hostName" class="text-lg font-semibold">{{ appearance.hostName }}</span>
      </header>
      <section v-if="error" class="order-panel space-y-4" role="alert">
        <h1 class="text-2xl font-semibold">
          {{ t(unavailable ? 'products.orderLinkUnavailable' : 'products.publicOrderLoadFailed') }}
        </h1>
        <p>{{ t(unavailable ? 'products.orderLinkUnavailableHelp' : 'products.publicOrderRetryHelp') }}</p>
        <UButton v-if="!unavailable" :loading="status === 'pending'" @click="refresh()">{{
          t('common.refresh')
        }}</UButton>
      </section>
      <p v-else-if="!order" role="status">{{ t('products.loading') }}</p>
      <template v-else>
        <section class="order-panel">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="order-muted text-sm">{{ t('products.publicOrderEyebrow') }}</p>
              <h1 class="mt-1 text-3xl font-semibold">{{ t('products.publicOrderTitle') }}</h1>
              <p class="mt-2 font-mono text-sm">{{ order.reference }}</p>
            </div>
            <UBadge :color="revoked ? 'error' : order.access ? 'success' : 'neutral'" variant="subtle">{{
              t(revoked ? 'products.accessRevoked' : `products.${order.status}`)
            }}</UBadge>
          </div>
          <dl class="mt-6 flex flex-wrap gap-x-12 gap-y-4 text-sm">
            <div>
              <dt class="order-muted">{{ t('products.purchaseSortDate') }}</dt>
              <dd class="mt-1">{{ new Date(order.createdAt).toLocaleDateString(order.locale) }}</dd>
            </div>
            <div v-if="order.total !== null">
              <dt class="order-muted">{{ t('products.amount') }}</dt>
              <dd class="mt-1 font-semibold">{{ formatMoney(order.total, order.currency, order.locale) }}</dd>
            </div>
          </dl>
          <p v-if="order.status === 'accepted'" class="mt-4 text-sm">{{ t('products.invoicePaymentHelp') }}</p>
        </section>
        <section v-if="!order.access" class="order-panel space-y-3" role="status">
          <h2 class="font-semibold">
            {{ t(waiting ? 'products.publicOrderPending' : 'products.publicOrderAccessUnavailable') }}
          </h2>
          <p>{{ t(waiting ? 'products.orderDownloadsPending' : 'products.publicOrderAccessHelp') }}</p>
          <UButton variant="outline" :loading="status === 'pending'" @click="refresh()">{{
            t('common.refresh')
          }}</UButton>
        </section>
        <section v-for="item in order.items" :key="item.id" class="order-panel space-y-5">
          <div class="flex items-start justify-between gap-4">
            <h2 class="text-xl font-semibold">{{ item.title }}</h2>
            <span v-if="item.quantity > 1" class="order-muted text-sm">× {{ item.quantity }}</span>
          </div>
          <template v-if="item.access">
            <div v-if="item.nextSteps" class="space-y-2 text-sm">
              <h3 class="font-semibold">{{ t('products.nextSteps') }}</h3>
              <p class="whitespace-pre-line">{{ item.nextSteps }}</p>
            </div>
            <div v-if="item.files.length" class="grid items-start gap-4 sm:grid-cols-2">
              <ProductsPurchasedFileCard
                v-for="file in item.files"
                :key="file.id"
                :file="file"
                :source="file.url"
                :inline-source="file.previewUrl"
              />
            </div>
            <ProductsPurchasedLinkCard v-for="link in item.links" :key="link.id" :link="link" />
            <div v-if="item.filesPending" role="status" class="space-y-3 text-sm">
              <p>{{ t('products.orderFilesPreparing') }}</p>
              <UButton variant="outline" :loading="status === 'pending'" @click="refresh()">{{
                t('common.refresh')
              }}</UButton>
            </div>
          </template>
          <p v-else-if="order.access" class="text-sm order-muted">{{ t('products.publicOrderItemRevoked') }}</p>
        </section>
        <footer class="order-muted text-center text-sm">{{ t('products.privateOrderLinkHelp') }}</footer>
      </template>
    </div>
  </main>
</template>

<style scoped>
.order-panel {
  padding: clamp(1.25rem, 4vw, 2rem);
  border: 1px solid var(--order-border);
  border-radius: var(--order-radius);
  background: var(--order-surface);
}
h1,
h2 {
  color: var(--order-display);
  font-family: var(--order-display-font);
}
.order-muted {
  color: var(--order-muted);
}
</style>
