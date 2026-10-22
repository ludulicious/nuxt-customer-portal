<script setup lang="ts">
import type { PublicOrderDetails } from '../../../../shared/public-order'
import { defaultOrderPageCopy, type OrderPageCopy } from '../../../../shared/page-texts'

definePageMeta({ public: true, layout: 'store', key: (route) => route.path })
const route = useRoute()
const ordersReturnTo = computed(() =>
  typeof route.query.ordersReturnTo === 'string' &&
  /^\/admin\/products\/orders(?:\?|$)/.test(route.query.ordersReturnTo)
    ? route.query.ordersReturnTo
    : undefined
)
const { locale, setLocale } = useI18n()
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
const language = locale.value === 'nl' ? 'nl' : 'en'
const { data: fallbackCopy } = await useFetch<OrderPageCopy>('/api/store/page-texts/order-details', {
  query: { locale: language },
  immediate: !order.value,
  watch: false
})
const copy = computed(() => order.value?.copy || fallbackCopy.value || defaultOrderPageCopy(language))
const unavailable = computed(() => !!error.value && [400, 404].includes(error.value.statusCode || 0))
useHead({
  title: () => copy.value.title,
  meta: [
    { name: 'robots', content: 'noindex, nofollow, noarchive' },
    { name: 'referrer', content: 'no-referrer' }
  ]
})
</script>

<template>
  <ProductsPublicOrder
    :order="order"
    :copy="copy"
    :back-url="ordersReturnTo"
    :error="!!error"
    :unavailable="unavailable"
    :loading="status === 'pending'"
    @refresh="refresh()"
  />
</template>
