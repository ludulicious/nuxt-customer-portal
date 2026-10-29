<script setup lang="ts">
import { resolveCheckoutQuery, resolveCheckoutReturnUrl } from '../../../../shared/checkout-query'
import { defaultCheckoutAppearance } from '../../../../shared/checkout-appearance'
import type { PurchaseAppointment } from '../../../../shared/purchase-appointment'
import type { PurchaseLink } from '../../../../shared/links'
import { purchaseReturnUrl, type PurchaseDownload } from '../../../../shared/downloads'

definePageMeta({ public: true, layout: 'store' })

const route = useRoute()
const api = useProducts()
const { locale, setLocale } = useI18n()
const { locale: requestedLocale, currency } = resolveCheckoutQuery(route.query)
if (locale.value !== requestedLocale) {
  await setLocale(requestedLocale)
}

const outcome = typeof route.query.payment === 'string' ? route.query.payment : ''
if (!['success', 'cancelled', 'failed', 'expired'].includes(outcome)) {
  throw createError({ statusCode: 404 })
}

let product = await api.catalog(String(route.params.slug), requestedLocale, currency)
if (!product.prices.length && currency) {
  product = await api.catalog(String(route.params.slug), requestedLocale)
}

const appearance = computed(() => product.checkoutAppearance || defaultCheckoutAppearance())
const checkoutReturnUrl = computed(() => resolveCheckoutReturnUrl(route.query.returnUrl, appearance.value.returnUrl))
const purchaseToken =
  outcome === 'success' && typeof route.query.purchase === 'string' && /^[a-f0-9]{64}$/.test(route.query.purchase)
    ? route.query.purchase
    : ''
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
const {
  data: delivery,
  error: deliveryError,
  status: deliveryStatus,
  refresh: refreshDelivery
} = await useFetch<
  {
    status: string
    storeMode?: 'sandbox' | 'live'
    variant?: 'free' | 'paid'
    appointments?: PurchaseAppointment[]
    files: PurchaseDownload[]
    links?: PurchaseLink[]
  },
  import('#app').NuxtError<unknown>,
  string
>(() => `/api/store/purchases/${encodeURIComponent(purchaseToken)}`, { immediate: !!purchaseToken, watch: false })
const thankYouUrl = computed(() =>
  purchaseToken ? purchaseReturnUrl(checkoutReturnUrl.value, purchaseToken) : checkoutReturnUrl.value
)
let deliveryTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  let attempts = 0
  if (!purchaseToken || delivery.value?.status !== 'pending') {
    return
  }
  deliveryTimer = setInterval(async () => {
    if (++attempts >= 20 || delivery.value?.status !== 'pending') {
      clearInterval(deliveryTimer)
      return
    }
    await refreshDelivery()
  }, 3000)
})
onUnmounted(() => clearInterval(deliveryTimer))
const selectedPrice = computed(() => product.prices[0])
const checkoutQuery = new URLSearchParams({
  locale: product.locale,
  ...(selectedPrice.value?.currency ? { currency: selectedPrice.value.currency } : {}),
  ...(checkoutReturnUrl.value ? { returnUrl: checkoutReturnUrl.value } : {})
})
const checkoutUrl = `/store/${encodeURIComponent(product.slug)}?${checkoutQuery.toString()}`

const variant = computed(
  () => delivery.value?.variant || (product.isFree || selectedPrice.value?.amount === 0 ? 'free' : 'paid')
)
const customCopy = computed(() => product.thankYou?.[variant.value])
</script>

<template>
  <ProductsOrderReceipt
    :product="product"
    :outcome="outcome"
    :delivery="delivery"
    :delivery-error="!!deliveryError"
    :delivery-loading="deliveryStatus === 'pending'"
    :purchase-token="purchaseToken"
    :thank-you-url="thankYouUrl"
    :checkout-url="checkoutUrl"
    :copy="customCopy"
    @refresh="refreshDelivery()"
  />
</template>
