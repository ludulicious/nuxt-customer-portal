<script setup lang="ts">
import { thankYouCopySchema, type ThankYouCopy, type ThankYouVariant } from '../../../../shared/thank-you'
import { resolveCheckoutQuery } from '../../../../shared/checkout-query'

definePageMeta({ public: true, layout: 'store' })
const route = useRoute()
const { locale, setLocale } = useI18n()
const requested = resolveCheckoutQuery(route.query)
if (locale.value !== requested.locale) {
  await setLocale(requested.locale)
}
const product = await useProducts().catalog(String(route.params.slug), requested.locale, requested.currency)
const copy = ref<ThankYouCopy>()
const variant = ref<ThankYouVariant>(route.query.variant === 'paid' ? 'paid' : 'free')
const { t } = useI18n()
const delivery = computed(() => ({
  status: 'paid',
  files: [{ id: 'preview', name: t('products.thankYouExampleFile'), url: '#' }]
}))
function receive(event: MessageEvent) {
  if (event.source !== window.parent || event.source === window) {
    return
  }
  if (event.data?.type !== 'products:thank-you-preview') {
    return
  }
  const parsed = thankYouCopySchema.safeParse(event.data.copy)
  if (!parsed.success || !['free', 'paid'].includes(event.data.variant)) {
    return
  }
  copy.value = parsed.data
  variant.value = event.data.variant
}
onMounted(() => {
  window.addEventListener('message', receive)
  // Readiness is public and contains no order, customer or file credentials.
  window.parent.postMessage({ type: 'products:thank-you-preview-ready' }, '*')
})
onBeforeUnmount(() => window.removeEventListener('message', receive))
useSeoMeta({ robots: 'noindex, nofollow', referrer: 'no-referrer' })
</script>

<template>
  <ProductsOrderReceipt
    :product="product"
    outcome="success"
    :delivery="delivery"
    :copy="copy"
    preview
    :preview-variant="variant"
  />
</template>
