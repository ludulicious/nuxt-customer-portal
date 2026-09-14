<script setup lang="ts">
import type { HoldResult } from '../../composables/usePlanning'
import { resolveCheckoutQuery, resolveCheckoutReturnUrl } from '@nuxt-customer-portal/products/shared/checkout-query'
import { formatMoney } from '@nuxt-customer-portal/products/shared/money'

definePageMeta({ path: '/store/:slug/book', public: true, layout: 'store' })
const route = useRoute(),
  { t, locale, setLocale } = useI18n(),
  query = resolveCheckoutQuery(route.query),
  product = await useProducts().catalog(String(route.params.slug), query.locale, query.currency)
if (locale.value !== query.locale) {
  await setLocale(query.locale)
}
if (!product.planningEnabled) {
  await navigateTo({ path: `/store/${encodeURIComponent(product.slug)}`, query: route.query })
}
const returnUrl = computed(() => resolveCheckoutReturnUrl(route.query.returnUrl, product.checkoutAppearance.returnUrl))
const currency = ref(
  product.prices.some((p) => p.currency === query.currency) ? query.currency! : product.prices[0]?.currency || 'EUR'
)
const appearance = computed(() => product.checkoutAppearance)
const themeStyle = computed(() => ({
  '--checkout-paper': appearance.value.paperColor,
  '--checkout-surface': appearance.value.surfaceColor,
  '--checkout-ink': appearance.value.inkColor,
  '--checkout-muted': appearance.value.mutedColor,
  '--checkout-display': appearance.value.displayColor,
  '--checkout-accent': appearance.value.accentColor,
  '--checkout-action': appearance.value.actionColor,
  '--checkout-focus': appearance.value.focusColor,
  '--checkout-border': appearance.value.borderColor,
  '--checkout-radius': `${appearance.value.radius}px`,
  '--checkout-display-font': appearance.value.displayFontFamily,
  '--checkout-body-font': appearance.value.bodyFontFamily
}))
const selectedPrice = computed(() => product.prices.find((price) => price.currency === currency.value))
const endpoint = String(useRuntimeConfig().public.productsImageKitUrlEndpoint || '').replace(/\/$/, '')
const imageSource = (url: string) => (endpoint && url.startsWith(`${endpoint}/`) ? url.slice(endpoint.length) : url)
const imageProvider = (url: string) => (endpoint && url.startsWith(`${endpoint}/`) ? 'imagekit' : undefined)
async function reserved(hold: HoldResult) {
  await navigateTo({
    path: `/store/${encodeURIComponent(product.slug)}`,
    query: { ...route.query, currency: hold.currency, locale: product.locale, holdToken: hold.holdToken }
  })
}
useHead({ title: `${t('planning.bookNow')} — ${product.title}`, meta: [{ name: 'referrer', content: 'no-referrer' }] })
</script>

<template>
  <main class="checkout-page booking-page" :style="themeStyle">
    <div class="checkout-shell">
      <header class="checkout-header">
        <a v-if="returnUrl" :href="returnUrl" class="checkout-back">← {{ t('products.backToOffering') }}</a>
        <img v-if="appearance.logoUrl" :src="appearance.logoUrl" :alt="appearance.hostName" class="checkout-logo" />
        <span v-else class="checkout-wordmark">{{ appearance.hostName }}</span>
        <span class="checkout-secure" :class="{ 'checkout-test': product.storeMode === 'sandbox' }">{{
          t(product.storeMode === 'sandbox' ? 'products.testCheckoutLabel' : 'products.secureCheckout')
        }}</span>
      </header>
      <div class="checkout-grid">
        <aside class="order-card" aria-labelledby="order-title">
          <p class="checkout-eyebrow">{{ t('products.yourSelection') }}</p>
          <div class="order-product">
            <NuxtImg
              v-if="product.thumbnailImage"
              :provider="imageProvider(product.thumbnailImage)"
              :src="imageSource(product.thumbnailImage)"
              :alt="product.title"
              preset="productThumbnail"
              width="112"
              height="112"
              class="order-thumbnail"
            />
            <div class="min-w-0">
              <h1 id="order-title">{{ product.title }}</h1>
              <p v-if="product.subtitle" class="order-subtitle">{{ product.subtitle }}</p>
            </div>
          </div>
          <p class="order-summary">{{ product.summary }}</p>
          <details class="mobile-offering-details">
            <summary>{{ t('planning.offeringDetails') }}</summary>
            <p>{{ product.summary }}</p>
          </details>
          <p class="booking-duration">
            <UIcon name="i-lucide-clock" aria-hidden="true" />{{
              t('planning.duration', { minutes: product.durationMinutes })
            }}
          </p>
          <div class="order-price">
            <span>{{ t('products.total') }}</span
            ><strong>{{
              product.isFree
                ? t('products.freeProduct')
                : selectedPrice
                  ? formatMoney(selectedPrice.amount, selectedPrice.currency, product.locale)
                  : ''
            }}</strong>
          </div>
          <UFormField v-if="product.prices.length > 1" :label="t('products.price')" class="mt-5">
            <USelect
              v-model="currency"
              class="w-full"
              :items="
                product.prices.map((p) => ({
                  value: p.currency,
                  label: formatMoney(p.amount, p.currency, product.locale)
                }))
              "
            />
          </UFormField>
        </aside>
        <section class="checkout-form-panel booking-panel" aria-labelledby="booking-title">
          <p class="checkout-eyebrow">{{ t('planning.bookNow') }}</p>
          <h2 id="booking-title">{{ t('planning.chooseAppointmentTime') }}</h2>
          <PlanningSlotPicker
            :key="currency"
            docked
            :product-id="product.id"
            :currency="currency"
            :locale="product.locale"
            @reserved="reserved"
          />
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped src="../../../../products/app/assets/css/checkout.css"></style>

<style scoped>
/* Hallmark · component: mobile booking · theme: existing checkout · tone: soft
 * pre-emit critique: P4 H5 E4 S5 R5 V4
 */
.mobile-offering-details {
  display: none;
}
.booking-page .booking-panel {
  --booking-field-background: var(--checkout-surface);
  background: var(--checkout-surface);
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  padding: clamp(20px, 3vw, 32px);
}
@media (min-width: 961px) {
  .booking-page .booking-panel > .checkout-eyebrow {
    margin-bottom: 12px;
  }
  .booking-page .order-product {
    align-items: start;
  }
  .booking-page #order-title,
  .booking-page #booking-title {
    line-height: 1.08;
  }
}
@media (max-width: 960px) {
  .booking-page .booking-panel {
    padding: 16px 12px;
  }
  .booking-page .checkout-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .booking-page .order-card {
    position: static;
  }
  .booking-page .checkout-shell {
    padding-top: 8px;
  }
  .booking-page .checkout-header {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 48px;
    margin-bottom: 12px;
  }
  .booking-page .checkout-secure {
    display: none;
  }
  .booking-page .checkout-test {
    display: block;
    grid-column: 1 / -1;
  }
  .booking-page .checkout-logo {
    max-height: 36px;
    max-width: 120px;
  }
  .booking-page .checkout-back {
    font-size: 0.75rem;
  }
  .booking-page .checkout-grid {
    gap: 16px;
  }
  .booking-page .order-card {
    padding: 12px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 12px;
  }
  .booking-page .order-product {
    grid-column: 1 / -1;
  }
  .booking-page .order-card > .mt-5 {
    grid-column: 1 / -1;
  }
  .booking-page .order-card > .checkout-eyebrow,
  .booking-page .order-summary,
  .booking-page .order-subtitle,
  .booking-page .booking-panel > .checkout-eyebrow {
    display: none;
  }
  .booking-page .order-product {
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 12px;
  }
  .booking-page .order-thumbnail {
    width: 48px;
    height: 48px;
  }
  .booking-page h1 {
    font-size: 1.25rem;
    line-height: 1.15;
  }
  .booking-page .booking-duration {
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    font-size: 0.85rem;
  }
  .booking-page .order-price {
    padding-top: 0;
    border: 0;
    font-size: 0.85rem;
  }
  .booking-page .order-price > span {
    display: none;
  }
  .booking-page .order-price strong {
    font-size: 1rem;
  }
  .mobile-offering-details {
    display: block;
    margin-top: 0;
    grid-column: 1 / -1;
    grid-row: 3;
    color: var(--checkout-muted);
    font-size: 0.85rem;
  }
  .mobile-offering-details summary {
    cursor: pointer;
    min-height: 28px;
  }
  .mobile-offering-details p {
    margin-block: 8px;
    line-height: 1.55;
  }
  .booking-page .booking-panel > h2 {
    font-size: 2rem;
    margin-bottom: 12px;
  }
}
.booking-panel > h2 {
  margin-bottom: 28px;
}
.booking-duration {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--checkout-accent) 25%, transparent);
  border-radius: calc(var(--checkout-radius) * 0.62);
  background: color-mix(in srgb, var(--checkout-accent) 7%, var(--checkout-surface));
  color: var(--checkout-display);
  font-size: 1.15rem;
  font-weight: 600;
}
.booking-duration :deep(svg),
.booking-duration :deep(.iconify) {
  width: 22px;
  height: 22px;
  color: var(--checkout-accent);
}
.booking-panel :deep(h2) {
  font-size: 1rem;
  line-height: 1.5;
}
.booking-panel > h2 {
  font-size: clamp(2.15rem, 5vw, 3.75rem);
  line-height: 1.04;
}
.booking-panel :deep(.text-muted) {
  color: var(--checkout-muted);
}
.booking-panel :deep(button) {
  --ui-primary: var(--checkout-accent);
}
</style>
