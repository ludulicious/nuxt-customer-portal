<script setup lang="ts">
import type { CheckoutAppearance } from '../../shared/checkout-appearance'

const props = defineProps<{
  appearance: CheckoutAppearance
  items?: Array<{ id: string; title: string; quantity?: number; subtitle?: string; thumbnailImage?: string | null }>
  totalLabel?: string
  priceLabel?: string
  backUrl?: string
  testOrder?: boolean
  preview?: boolean
  previewNotice?: string
  label?: string
}>()
const { t } = useI18n()
const appearance = toRef(props, 'appearance')
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
  <main class="payment-return-page" :class="{ 'is-preview': preview }" :style="themeStyle">
    <div class="payment-return-shell">
      <p v-if="previewNotice" class="preview-notice" role="status">{{ previewNotice }}</p>
      <ProductsTestOrderNotice v-if="testOrder" class="test-order-notice" />
      <header class="payment-return-header">
        <a
          v-if="backUrl"
          :href="backUrl"
          class="host-return"
          rel="noreferrer"
          @click="preview && $event.preventDefault()"
          >← {{ t('products.backToOffering') }}</a
        >
        <img
          v-if="appearance.logoUrl"
          :src="appearance.logoUrl"
          :alt="appearance.hostName"
          referrerpolicy="no-referrer"
          class="return-logo"
        />
        <span v-else class="return-wordmark">{{ appearance.hostName }}</span>
      </header>

      <section class="return-grid" :class="{ 'without-selection': !items?.length }" :aria-label="label">
        <div v-if="items?.length" class="product-half">
          <p class="selection-label">{{ t('products.yourSelection') }}</p>
          <div v-for="item in items" :key="item.id" class="selection-item">
            <div class="product-row" :class="{ 'product-row--without-image': !item.thumbnailImage }">
              <NuxtImg
                v-if="item.thumbnailImage"
                :provider="imageProvider(item.thumbnailImage)"
                :src="imageSource(item.thumbnailImage)"
                :alt="item.title"
                preset="productThumbnail"
                width="112"
                height="112"
                class="return-thumbnail"
              />
              <div>
                <h2>
                  {{ item.title }}<span v-if="item.quantity && item.quantity > 1"> × {{ item.quantity }}</span>
                </h2>
                <p v-if="item.subtitle">{{ item.subtitle }}</p>
              </div>
            </div>
          </div>
          <div v-if="totalLabel" class="return-price">
            <span>{{ priceLabel || t('products.total') }}</span>
            <strong>{{ totalLabel }}</strong>
          </div>
        </div>

        <div class="receipt-content"><slot /></div>
      </section>
      <footer v-if="$slots.footer" class="receipt-footer"><slot name="footer" /></footer>
    </div>
  </main>
</template>

<style scoped>
/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * macrostructure: shared purchase receipt · theme: provider checkout
 */
:global(html),
:global(body) {
  overflow-x: clip;
}
.test-order-notice {
  margin-block: 12px;
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
  color-scheme: light;
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
  width: 145px;
  height: 48px;
  max-width: 100%;
  object-fit: contain;
}
.return-wordmark {
  color: var(--checkout-display);
  font-family: var(--checkout-display-font);
  font-size: 1.35rem;
}
.host-return {
  color: var(--checkout-muted);
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
.product-row p {
  color: var(--checkout-muted);
  line-height: 1.6;
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
@media (min-width: 48rem) {
  .payment-return-shell {
    width: min(100% - 48px, 1080px);
    padding-top: 18px;
  }
  .return-grid {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  }
  .product-half {
    order: 1;
    border-top: 0;
    border-right: 1px solid var(--checkout-border);
  }
}

.payment-return-page {
  --ui-bg: var(--checkout-surface);
  --ui-bg-elevated: var(--checkout-paper);
  --ui-bg-accented: var(--checkout-paper);
  --ui-bg-muted: var(--checkout-paper);
  --ui-border: var(--checkout-border);
  --ui-border-muted: var(--checkout-border);
  --ui-text: var(--checkout-ink);
  --ui-text-highlighted: var(--checkout-ink);
  --ui-text-muted: var(--checkout-muted);
  --ui-text-dimmed: var(--checkout-muted);
  --ui-text-toned: var(--checkout-ink);
  --ui-text-inverted: var(--checkout-surface);
  --ui-primary: var(--checkout-action);
}
.payment-return-page.is-preview {
  min-height: 0;
}
.payment-return-header {
  grid-template-columns: minmax(0, 1fr) auto;
}
.return-logo,
.return-wordmark {
  order: initial;
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  object-position: right center;
}
.host-return {
  grid-column: 1;
  grid-row: 1;
  justify-self: start;
  white-space: normal;
}
.receipt-content {
  order: 2;
  min-width: 0;
  padding: clamp(24px, 4vw, 48px);
}
.product-half {
  order: 1;
  border-top: 0;
  border-bottom: 1px solid var(--checkout-border);
}
.selection-item + .selection-item {
  margin-top: 24px;
}
.product-row h2 {
  margin: 0;
  color: var(--checkout-display);
  font-family: var(--checkout-display-font);
  font-size: clamp(1.2rem, 2.2vw, 1.5rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.receipt-footer {
  color: var(--checkout-muted);
  font-size: 0.75rem;
  line-height: 1.6;
  text-align: center;
}
.return-grid.without-selection {
  grid-template-columns: minmax(0, 1fr);
}
.host-return:focus-visible {
  outline: 3px solid var(--checkout-focus);
  outline-offset: 3px;
}
@media (min-width: 48rem) {
  .product-half {
    border-bottom: 0;
  }
}
</style>
