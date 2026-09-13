<script setup lang="ts">
import type { HoldResult } from '../../composables/usePlanning'
import { resolveCheckoutQuery, resolveCheckoutReturnUrl } from '@nuxt-customer-portal/products/shared/checkout-query'
import { formatMoney } from '@nuxt-customer-portal/products/shared/money'

definePageMeta({ path: '/store/:slug/book', public: true, layout: 'store' })
const route = useRoute(),
  { t } = useI18n(),
  query = resolveCheckoutQuery(route.query),
  product = await useProducts().catalog(String(route.params.slug), query.locale, query.currency)
if (!product.planningEnabled) {
  await navigateTo({ path: `/store/${encodeURIComponent(product.slug)}`, query: route.query })
}
const returnUrl = computed(() => resolveCheckoutReturnUrl(route.query.returnUrl, product.checkoutAppearance.returnUrl))
const currency = ref(
  product.prices.some((p) => p.currency === query.currency) ? query.currency! : product.prices[0]?.currency || 'EUR'
)
async function reserved(hold: HoldResult) {
  await navigateTo({
    path: `/store/${encodeURIComponent(product.slug)}`,
    query: { ...route.query, currency: hold.currency, locale: product.locale, holdToken: hold.holdToken }
  })
}
useHead({ title: `${t('planning.bookNow')} — ${product.title}`, meta: [{ name: 'referrer', content: 'no-referrer' }] })
</script>

<template>
  <main class="mx-auto max-w-2xl space-y-6 px-4 py-10">
    <UButton v-if="returnUrl" :to="returnUrl" color="neutral" variant="link">{{ t('planning.back') }}</UButton>
    <UAlert v-if="product.storeMode === 'sandbox'" color="warning" :title="t('products.sandboxBanner')" />
    <h1 class="text-3xl font-bold">{{ product.title }}</h1>
    <p>{{ product.summary }}</p>
    <p>{{ t('planning.duration', { minutes: product.durationMinutes }) }}</p>
    <UFormField :label="t('products.price')"
      ><USelect
        v-model="currency"
        :items="
          product.prices.map((p) => ({ value: p.currency, label: formatMoney(p.amount, p.currency, product.locale) }))
        "
    /></UFormField>
    <PlanningSlotPicker
      :key="currency"
      :product-id="product.id"
      :currency="currency"
      :locale="product.locale"
      @reserved="reserved"
    />
  </main>
</template>
