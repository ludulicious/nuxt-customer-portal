<script setup lang="ts">
import { resolveCheckoutQuery, resolveCheckoutReturnUrl } from '../../../../shared/checkout-query'
import { defaultCheckoutAppearance } from '../../../../shared/checkout-appearance'
import { formatMoney } from '../../../../shared/money'

definePageMeta({ public: true, layout: 'store' })

const route = useRoute()
const api = useProducts()
const { t, locale, setLocale } = useI18n()
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
const selectedPrice = computed(() => product.prices[0])
const outcomeKey = `${outcome[0]!.toUpperCase()}${outcome.slice(1)}`
const outcomeIcon = {
  success: 'i-lucide-circle-check',
  cancelled: 'i-lucide-ban',
  failed: 'i-lucide-circle-x',
  expired: 'i-lucide-clock-3'
}[outcome]!
const checkoutQuery = new URLSearchParams({
  locale: product.locale,
  ...(selectedPrice.value?.currency ? { currency: selectedPrice.value.currency } : {}),
  ...(checkoutReturnUrl.value ? { returnUrl: checkoutReturnUrl.value } : {})
})
const checkoutUrl = `/store/${encodeURIComponent(product.slug)}?${checkoutQuery.toString()}`
const endpoint = String(useRuntimeConfig().public.productsImageKitUrlEndpoint || '').replace(/\/$/, '')
const imageSource = (url: string) => (endpoint && url.startsWith(`${endpoint}/`) ? url.slice(endpoint.length) : url)
const imageProvider = (url: string) => (endpoint && url.startsWith(`${endpoint}/`) ? 'imagekit' : undefined)
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
  '--checkout-danger': '#a12d2a',
  '--checkout-danger-surface': '#fff3f1',
  '--checkout-danger-ink': '#ffffff',
  '--checkout-radius': `${appearance.value.radius}px`,
  '--checkout-display-font': appearance.value.displayFontFamily,
  '--checkout-body-font': appearance.value.bodyFontFamily
}))
</script>

<template>
  <main class="payment-return-page" :style="themeStyle">
    <div class="payment-return-shell">
      <header class="payment-return-header">
        <a v-if="checkoutReturnUrl" :href="checkoutReturnUrl" class="host-return"
          >← {{ t('products.backToOffering') }}</a
        >
        <img v-if="appearance.logoUrl" :src="appearance.logoUrl" :alt="appearance.hostName" class="return-logo" />
        <span v-else class="return-wordmark">{{ appearance.hostName }}</span>
        <span class="secure-label">{{ t('products.secureCheckout') }}</span>
      </header>

      <section class="return-grid" aria-labelledby="payment-return-title">
        <div class="product-half">
          <p class="selection-label">{{ t('products.yourSelection') }}</p>
          <div class="product-row">
            <NuxtImg
              v-if="product.thumbnailImage"
              :provider="imageProvider(product.thumbnailImage)"
              :src="imageSource(product.thumbnailImage)"
              :alt="product.title"
              preset="productThumbnail"
              width="112"
              height="112"
              class="return-thumbnail"
            />
            <div>
              <h2>{{ product.title }}</h2>
              <p v-if="product.subtitle">{{ product.subtitle }}</p>
            </div>
          </div>
          <div v-if="selectedPrice" class="return-price">
            <span>{{ t('products.total') }}</span>
            <strong>{{
              selectedPrice.amount === 0
                ? t('products.freeProduct')
                : formatMoney(selectedPrice.amount, selectedPrice.currency, product.locale)
            }}</strong>
          </div>
        </div>

        <div :class="['outcome-half', `outcome--${outcome}`]" role="status" aria-live="polite">
          <div class="outcome-mark">
            <UIcon :name="outcomeIcon" class="outcome-icon" aria-hidden="true" />
            <span>{{ t(`products.paymentStatus${outcomeKey}`) }}</span>
          </div>
          <h1 id="payment-return-title">{{ t(`products.paymentReturnTitle${outcomeKey}`) }}</h1>
          <p>{{ t(`products.paymentReturn${outcomeKey}`) }}</p>
          <p class="quiet-help">
            {{ t(outcome === 'success' ? 'products.paymentReturnSuccessHelp' : 'products.paymentReturnHelp') }}
          </p>
          <div class="return-actions">
            <NuxtLink :to="outcome === 'success' ? '/purchases' : checkoutUrl" class="retry-action">
              {{ t(outcome === 'success' ? 'products.purchases' : 'products.tryAgain') }}
            </NuxtLink>
            <a v-if="checkoutReturnUrl" :href="checkoutReturnUrl" class="offering-action">
              {{ t('products.backToOffering') }}
            </a>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * genre: editorial · macrostructure: Split Studio · theme: host checkout · enrichment: product thumbnail
 */
.payment-return-page {
  min-height: 100dvh;
  overflow-x: clip;
  background: var(--checkout-paper);
  color: var(--checkout-ink);
  font-family: var(--checkout-body-font);
}
.payment-return-shell {
  width: min(100% - 24px, 1080px);
  margin-inline: auto;
  padding-block: 12px 48px;
}
.payment-return-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 78px;
  border-bottom: 1px solid var(--checkout-border);
}
.return-logo {
  order: -1;
  max-width: 145px;
  max-height: 48px;
  object-fit: contain;
  object-position: left center;
}
.return-wordmark {
  order: -1;
  color: var(--checkout-display);
  font-family: var(--checkout-display-font);
  font-size: 1.35rem;
}
.host-return {
  justify-self: end;
  color: var(--checkout-muted);
  white-space: nowrap;
}
.secure-label {
  display: none;
  color: var(--checkout-muted);
  font-size: 0.82rem;
}
.return-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(32px, 7vw, 88px);
  align-items: center;
  padding-block: clamp(52px, 9vw, 112px);
}
.product-half {
  order: 2;
}
.outcome-half {
  order: 1;
  padding: clamp(24px, 4vw, 48px);
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  background: var(--checkout-surface);
}
.product-half {
  min-width: 0;
  padding: clamp(20px, 3vw, 32px);
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  background: var(--checkout-surface);
}
.selection-label {
  margin: 0 0 20px;
  color: var(--checkout-accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.product-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}
.return-thumbnail {
  width: 88px;
  height: 88px;
  border-radius: calc(var(--checkout-radius) * 0.55);
  object-fit: cover;
}
h1,
h2 {
  margin: 0;
  color: var(--checkout-display);
  font-family: var(--checkout-display-font);
  font-style: normal;
  overflow-wrap: anywhere;
}
h1 {
  max-width: 22ch;
  font-family: var(--checkout-body-font);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.12;
}
h2 {
  font-size: clamp(1.45rem, 3vw, 2rem);
  line-height: 1.08;
}
.product-row p,
.outcome-half p {
  color: var(--checkout-muted);
  line-height: 1.6;
}
.product-row p {
  margin: 8px 0 0;
}
.return-price {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--checkout-border);
}
.return-price strong {
  color: var(--checkout-display);
}
.outcome-half {
  min-width: 0;
}
.outcome-mark {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  color: var(--checkout-accent);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.outcome-icon {
  width: 30px;
  height: 30px;
}
.outcome--failed {
  border-color: var(--checkout-danger);
  background: var(--checkout-danger-surface);
}
.outcome--failed .outcome-mark {
  padding: 4px 14px 4px 8px;
  border-radius: 999px;
  background: var(--checkout-danger);
  color: var(--checkout-danger-ink);
}
.outcome--failed h1 {
  color: var(--checkout-danger);
}
.outcome-half > p {
  max-width: 55ch;
  margin: 20px 0 0;
}
.outcome-half .quiet-help {
  margin-top: 8px;
  font-size: 0.88rem;
}
.return-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  margin-top: 32px;
}
.retry-action,
.offering-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.retry-action {
  padding-inline: 24px;
  border: 1px solid var(--checkout-action);
  border-radius: calc(var(--checkout-radius) * 0.65);
  background: var(--checkout-action);
  color: var(--checkout-surface);
  font-weight: 700;
  transition:
    transform 120ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 120ms cubic-bezier(0.16, 1, 0.3, 1);
}
.offering-action {
  color: var(--checkout-display);
  text-decoration: underline;
  text-decoration-color: var(--checkout-border);
  text-underline-offset: 4px;
}
@media (hover: hover) and (pointer: fine) {
  .retry-action:hover {
    transform: translateY(-1px);
  }
  .offering-action:hover,
  .host-return:hover {
    color: var(--checkout-accent);
  }
}
.retry-action:active {
  transform: translateY(0);
  opacity: 0.88;
}
.retry-action:focus-visible,
.offering-action:focus-visible,
.host-return:focus-visible {
  outline: 3px solid var(--checkout-focus);
  outline-offset: 3px;
}
@media (min-width: 48rem) {
  .payment-return-shell {
    width: min(100% - 48px, 1080px);
    padding-top: 18px;
  }
  .payment-return-header {
    grid-template-columns: 1fr auto 1fr;
  }
  .return-logo,
  .return-wordmark {
    order: initial;
    grid-column: 2;
    grid-row: 1;
    justify-self: center;
    object-position: center;
  }
  .host-return {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
  }
  .secure-label {
    display: inline;
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }
  .return-grid {
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  }
  .product-half {
    order: 1;
  }
  .outcome-half {
    order: 2;
  }
}
@media (prefers-reduced-motion: reduce) {
  .retry-action {
    transition-duration: 0.01ms;
  }
}
</style>
