<script setup lang="ts">
import type { PublicOrderDetails } from '../../shared/public-order'
import type { OrderPageCopy } from '../../shared/page-texts'
import { defaultCheckoutAppearance } from '../../shared/checkout-appearance'
import { formatMoney } from '../../shared/money'

const props = defineProps<{
  order?: PublicOrderDetails | null
  copy: OrderPageCopy
  error?: boolean
  unavailable?: boolean
  loading?: boolean
  preview?: boolean
}>()
defineEmits<{ refresh: [] }>()
const { t } = useI18n()
const statusLabel = computed(() => {
  if (revoked.value) {
    return props.copy.statusRevoked
  }
  const keys = {
    pending: 'statusPending',
    accepted: 'statusAccepted',
    paid: 'statusPaid',
    failed: 'statusFailed',
    expired: 'statusExpired'
  } as const
  return props.order ? props.copy[keys[props.order.status]] : ''
})
const appearance = computed(() => props.order?.appearance || defaultCheckoutAppearance())
const isFree = computed(
  () =>
    props.order?.total === 0 ||
    (props.order?.total === null &&
      props.order.items.length > 0 &&
      props.order.items.every((item) => item.amount === 0))
)
const contentItems = computed(
  () =>
    props.order?.items.filter(
      (item) =>
        props.order?.access &&
        (!item.access || item.nextSteps || item.files.length || item.links.length || item.filesPending)
    ) || []
)
const waiting = computed(() => props.order?.status === 'pending')
const revoked = computed(
  () => !!props.order && !props.order.access && ['paid', 'accepted'].includes(props.order.status)
)
</script>

<template>
  <ProductsPurchaseLayout
    :appearance="appearance"
    :items="order?.items"
    :total-label="
      order?.total !== null && order?.total !== undefined
        ? order.total === 0
          ? t('products.freeProduct')
          : formatMoney(order.total, order.currency, order.locale)
        : undefined
    "
    :price-label="copy.totalLabel"
    :preview="preview"
    :label="copy.title"
  >
    <section v-if="error" class="space-y-4" role="alert">
      <h1>{{ unavailable ? copy.unavailableTitle : copy.errorTitle }}</h1>
      <p>{{ unavailable ? copy.unavailableText : copy.errorText }}</p>
      <UButton v-if="!unavailable" :loading="loading" :disabled="preview" @click="$emit('refresh')">{{
        copy.refreshLabel
      }}</UButton>
    </section>
    <p v-else-if="!order" role="status">{{ copy.loadingText }}</p>
    <template v-else>
      <p class="order-eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <div v-if="copy.contentHtml" class="mt-5" @click="preview && $event.preventDefault()">
        <ProductsMarkdown :html="copy.contentHtml" />
      </div>
      <p v-if="order.status === 'accepted' && !isFree" class="mt-4 text-sm">{{ copy.invoiceHelp }}</p>
      <section v-if="!order.access" class="order-content space-y-3" role="status">
        <h2>{{ waiting ? copy.pendingHeading : copy.accessHeading }}</h2>
        <p>{{ waiting ? copy.pendingText : copy.accessText }}</p>
        <UButton variant="outline" :loading="loading" :disabled="preview" @click="$emit('refresh')">{{
          copy.refreshLabel
        }}</UButton>
      </section>
      <section v-for="item in contentItems" :key="item.id" class="order-content">
        <h2 v-if="order.items.length > 1">
          {{ item.title }}<span v-if="item.quantity > 1" class="order-muted"> × {{ item.quantity }}</span>
        </h2>
        <template v-if="item.access">
          <div v-if="item.nextSteps" class="space-y-2 text-sm">
            <h2>{{ copy.instructionsHeading }}</h2>
            <p class="whitespace-pre-line">{{ item.nextSteps }}</p>
          </div>
          <ProductsPurchaseContent :files="item.files" :links="item.links" :copy="copy" :preview="preview" />
          <div v-if="item.filesPending" role="status" class="mt-4 space-y-3 text-sm">
            <p>{{ copy.filesPreparing }}</p>
            <UButton variant="outline" :loading="loading" :disabled="preview" @click="$emit('refresh')">{{
              copy.refreshLabel
            }}</UButton>
          </div>
        </template>
        <p v-else-if="order.access" class="text-sm order-muted">{{ copy.itemRevokedText }}</p>
      </section>
      <dl class="order-metadata">
        <div>
          <dt class="sr-only">{{ copy.eyebrow }}</dt>
          <dd>{{ order.reference }}</dd>
        </div>
        <div>
          <dt>{{ copy.dateLabel }}</dt>
          <dd>{{ new Date(order.createdAt).toLocaleDateString(order.locale) }}</dd>
        </div>
        <div v-if="!isFree">
          <dt class="sr-only">{{ t('products.status') }}</dt>
          <dd>{{ statusLabel }}</dd>
        </div>
      </dl>
    </template>
    <template v-if="order && !error" #footer>{{ copy.footer }}</template>
  </ProductsPurchaseLayout>
</template>

<style scoped>
h1,
h2 {
  color: var(--checkout-display);
  font-family: var(--checkout-display-font);
  font-style: normal;
  overflow-wrap: anywhere;
}
h1 {
  margin: 0;
  font-size: clamp(1.75rem, 3.5vw, 2.5rem);
  line-height: 1.12;
  font-weight: 700;
  letter-spacing: -0.025em;
}
h2 {
  font-size: 1rem;
  font-family: var(--checkout-body-font);
  font-weight: 600;
}
p {
  line-height: 1.6;
}
.order-muted {
  color: var(--checkout-muted);
}
.order-eyebrow {
  margin-bottom: 16px;
  color: var(--checkout-accent);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.order-content {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--checkout-border);
}
.order-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 32px;
  color: var(--checkout-muted);
  font-size: 0.75rem;
  line-height: 1.6;
}
.order-metadata div {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
