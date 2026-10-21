<script setup lang="ts">
import type { CatalogProduct } from '../../shared/types'
import type { PurchaseDownload } from '../../shared/downloads'
import type { ThankYouCopy, ThankYouVariant } from '../../shared/thank-you'
import { defaultCheckoutAppearance } from '../../shared/checkout-appearance'
import { formatMoney } from '../../shared/money'

const props = defineProps<{
  product: CatalogProduct
  outcome: string
  delivery?: { status: string; files: PurchaseDownload[] } | null
  deliveryError?: boolean
  deliveryLoading?: boolean
  purchaseToken?: string
  thankYouUrl?: string
  checkoutUrl?: string
  copy?: ThankYouCopy
  preview?: boolean
  previewVariant?: ThankYouVariant
}>()
defineEmits<{ refresh: [] }>()
const { t } = useI18n()
const appearance = computed(() => props.product.checkoutAppearance || defaultCheckoutAppearance())
const selectedPrice = computed(() => {
  const price = props.product.prices[0]
  if (!price || !props.previewVariant) {
    return price
  }
  return { ...price, amount: props.previewVariant === 'free' ? 0 : price.originalAmount || price.amount }
})
const outcomeKey = computed(() => `${props.outcome[0]!.toUpperCase()}${props.outcome.slice(1)}`)
const outcomeIcons: Record<string, string> = {
  success: 'i-lucide-circle-check',
  cancelled: 'i-lucide-ban',
  failed: 'i-lucide-circle-x',
  expired: 'i-lucide-clock-3'
}
const outcomeIcon = computed(() => outcomeIcons[props.outcome] || 'i-lucide-circle-check')
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
      <p v-if="preview" class="preview-notice" role="status">{{ t('products.thankYouPreviewNotice') }}</p>
      <header class="payment-return-header">
        <a
          v-if="thankYouUrl"
          :href="thankYouUrl"
          class="host-return"
          rel="noreferrer"
          @click="preview && $event.preventDefault()"
          >← {{ t('products.backToOffering') }}</a
        >
        <img v-if="appearance.logoUrl" :src="appearance.logoUrl" :alt="appearance.hostName" class="return-logo" />
        <span v-else class="return-wordmark">{{ appearance.hostName }}</span>
        <span class="secure-label">{{ t('products.secureCheckout') }}</span>
      </header>

      <section class="return-grid" aria-labelledby="payment-return-title">
        <div class="product-half">
          <p class="selection-label">{{ t('products.yourSelection') }}</p>
          <div class="product-row" :class="{ 'product-row--without-image': !product.thumbnailImage }">
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
              preview && previewVariant === 'paid' && selectedPrice.amount === 0
                ? t('products.thankYouPaidPreview')
                : selectedPrice.amount === 0
                  ? t('products.freeProduct')
                  : formatMoney(selectedPrice.amount, selectedPrice.currency, product.locale)
            }}</strong>
          </div>
        </div>

        <div :class="['outcome-half', `outcome--${outcome}`]" role="status" aria-live="polite">
          <div class="outcome-mark">
            <UIcon :name="outcomeIcon" class="outcome-icon" aria-hidden="true" />
            <span>{{
              outcome === 'success' && copy ? copy.statusLabel : t(`products.paymentStatus${outcomeKey}`)
            }}</span>
          </div>
          <h1 id="payment-return-title">
            {{ outcome === 'success' && copy ? copy.heading : t(`products.paymentReturnTitle${outcomeKey}`) }}
          </h1>
          <p>
            {{ outcome === 'success' && copy ? copy.message : t(`products.paymentReturn${outcomeKey}`) }}
          </p>
          <p v-if="delivery?.status === 'accepted'">{{ t('products.invoicePaymentHelp') }}</p>
          <p class="quiet-help">
            {{
              outcome === 'success' && copy
                ? copy.helpText
                : t(outcome === 'success' ? 'products.paymentReturnSuccessHelp' : 'products.paymentReturnHelp')
            }}
          </p>
          <section
            v-if="
              delivery?.files.length || deliveryError || (purchaseToken && (!delivery || delivery.status === 'pending'))
            "
            class="return-downloads"
            aria-labelledby="return-downloads-title"
          >
            <h2 id="return-downloads-title">{{ copy?.downloadsHeading || t('products.orderDownloads') }}</h2>
            <ul v-if="delivery?.files.length" class="download-list">
              <li v-for="file in delivery.files" :key="file.id">
                <a
                  :href="file.url"
                  class="download-file"
                  rel="noreferrer"
                  referrerpolicy="no-referrer"
                  :aria-disabled="preview || undefined"
                  @click="preview && $event.preventDefault()"
                >
                  <UIcon name="i-lucide-file-down" class="download-icon" aria-hidden="true" />
                  <span class="download-name">{{ file.name }}</span>
                  <UIcon name="i-lucide-arrow-down-to-line" class="download-icon" aria-hidden="true" />
                </a>
              </li>
            </ul>
            <template v-else>
              <p :role="deliveryError ? 'alert' : undefined">
                {{ t(deliveryError ? 'products.orderDownloadsError' : 'products.orderDownloadsPending') }}
              </p>
              <button class="downloads-refresh" type="button" :disabled="deliveryLoading" @click="$emit('refresh')">
                {{ t('products.refreshDownloads') }}
              </button>
            </template>
          </section>
          <div class="return-actions">
            <NuxtLink
              :aria-disabled="preview || undefined"
              :to="outcome === 'success' ? '/purchases' : checkoutUrl"
              class="retry-action"
              @click="preview && $event.preventDefault()"
            >
              {{ t(outcome === 'success' ? 'products.purchases' : 'products.tryAgain') }}
            </NuxtLink>
            <a
              v-if="thankYouUrl"
              :href="thankYouUrl"
              class="offering-action"
              rel="noreferrer"
              @click="preview && $event.preventDefault()"
            >
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
 * genre: editorial · macrostructure: Order receipt · theme: host checkout · enrichment: product thumbnail
 */
:global(html),
:global(body) {
  overflow-x: clip;
}
.preview-notice {
  padding: 12px 16px;
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  background: var(--checkout-surface);
  color: var(--checkout-muted);
}
.payment-return-page:has(.preview-notice) {
  min-height: 0;
}
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
  gap: 0;
  align-items: stretch;
  margin-block: clamp(28px, 5vw, 56px);
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  background: var(--checkout-surface);
  overflow: clip;
}
.product-half {
  order: 2;
}
.outcome-half {
  order: 1;
  padding: clamp(24px, 4vw, 48px);
}
.product-half {
  min-width: 0;
  padding: clamp(20px, 3vw, 32px);
  border-top: 1px solid var(--checkout-border);
  background: var(--checkout-paper);
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
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}
.product-row--without-image {
  grid-template-columns: minmax(0, 1fr);
}
.return-thumbnail {
  width: 64px;
  height: 64px;
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
  font-family: var(--checkout-display-font);
  font-size: clamp(1.75rem, 3.5vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.12;
}
h2 {
  font-size: clamp(1.2rem, 2.2vw, 1.5rem);
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
  margin-bottom: 16px;
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
  white-space: pre-line;
  max-width: 55ch;
  margin: 20px 0 0;
}
.outcome-half .quiet-help {
  margin-top: 8px;
  font-size: 0.88rem;
}
.return-downloads {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--checkout-border);
}
.return-downloads h2 {
  font-family: var(--checkout-body-font);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5;
}
.download-list {
  display: grid;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}
.download-file {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 12px;
  border: 1px solid var(--checkout-border);
  border-radius: calc(var(--checkout-radius) * 0.45);
  color: var(--checkout-action);
  text-decoration: none;
}
.download-name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.5;
}
.download-icon {
  width: 100%;
  height: 20px;
}
.downloads-refresh {
  min-height: 44px;
  margin-top: 8px;
  color: var(--checkout-action);
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}
.downloads-refresh:disabled {
  opacity: 0.6;
  cursor: wait;
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
  .download-file:hover {
    background: var(--checkout-paper);
    border-color: var(--checkout-action);
  }
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
.download-file:focus-visible,
.downloads-refresh:focus-visible,
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
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  }
  .product-half {
    order: 1;
    border-top: 0;
    border-right: 1px solid var(--checkout-border);
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
