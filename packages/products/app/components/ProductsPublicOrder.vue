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
const waiting = computed(() => props.order?.status === 'pending')
const revoked = computed(
  () => !!props.order && !props.order.access && ['paid', 'accepted'].includes(props.order.status)
)
</script>

<template>
  <main class="public-order px-4 py-8 sm:py-12" :class="{ 'min-h-screen': !preview }" :style="themeStyle">
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
          {{ unavailable ? copy.unavailableTitle : copy.errorTitle }}
        </h1>
        <p>{{ unavailable ? copy.unavailableText : copy.errorText }}</p>
        <UButton v-if="!unavailable" :loading="loading" :disabled="preview" @click="$emit('refresh')">{{
          copy.refreshLabel
        }}</UButton>
      </section>
      <p v-else-if="!order" role="status">{{ copy.loadingText }}</p>
      <template v-else>
        <section class="order-panel">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="order-muted text-sm">{{ copy.eyebrow }}</p>
              <h1 class="mt-1 text-3xl font-semibold">{{ copy.title }}</h1>
              <p class="mt-2 font-mono text-sm">{{ order.reference }}</p>
            </div>
            <UBadge :color="revoked ? 'error' : order.access ? 'success' : 'neutral'" variant="subtle">{{
              statusLabel
            }}</UBadge>
          </div>
          <div v-if="copy.contentHtml" class="mt-4" @click="preview && $event.preventDefault()">
            <ProductsMarkdown :html="copy.contentHtml" />
          </div>
          <dl class="mt-6 flex flex-wrap gap-x-12 gap-y-4 text-sm">
            <div>
              <dt class="order-muted">{{ copy.dateLabel }}</dt>
              <dd class="mt-1">{{ new Date(order.createdAt).toLocaleDateString(order.locale) }}</dd>
            </div>
            <div v-if="order.total !== null">
              <dt class="order-muted">{{ copy.totalLabel }}</dt>
              <dd class="mt-1 font-semibold">{{ formatMoney(order.total, order.currency, order.locale) }}</dd>
            </div>
          </dl>
          <p v-if="order.status === 'accepted'" class="mt-4 text-sm">{{ copy.invoiceHelp }}</p>
        </section>
        <section v-if="!order.access" class="order-panel space-y-3" role="status">
          <h2 class="font-semibold">
            {{ waiting ? copy.pendingHeading : copy.accessHeading }}
          </h2>
          <p>{{ waiting ? copy.pendingText : copy.accessText }}</p>
          <UButton variant="outline" :loading="loading" :disabled="preview" @click="$emit('refresh')">{{
            copy.refreshLabel
          }}</UButton>
        </section>
        <section v-for="item in order.items" :key="item.id" class="order-panel space-y-5">
          <div class="flex items-start justify-between gap-4">
            <h2 class="text-xl font-semibold">{{ item.title }}</h2>
            <span v-if="item.quantity > 1" class="order-muted text-sm">× {{ item.quantity }}</span>
          </div>
          <template v-if="item.access">
            <div v-if="item.nextSteps" class="space-y-2 text-sm">
              <h3 class="font-semibold">{{ copy.instructionsHeading }}</h3>
              <p class="whitespace-pre-line">{{ item.nextSteps }}</p>
            </div>
            <div v-if="item.files.length" class="grid items-start gap-4 sm:grid-cols-2">
              <ProductsPurchasedFileCard
                v-for="file in item.files"
                :key="file.id"
                :file="file"
                :source="file.url"
                :inline-source="file.previewUrl"
                :copy="copy"
                :preview="preview"
              />
            </div>
            <ProductsPurchasedLinkCard
              v-for="link in item.links"
              :key="link.id"
              :link="link"
              :copy="copy"
              :preview="preview"
            />
            <div v-if="item.filesPending" role="status" class="space-y-3 text-sm">
              <p>{{ copy.filesPreparing }}</p>
              <UButton variant="outline" :loading="loading" :disabled="preview" @click="$emit('refresh')">{{
                copy.refreshLabel
              }}</UButton>
            </div>
          </template>
          <p v-else-if="order.access" class="text-sm order-muted">{{ copy.itemRevokedText }}</p>
        </section>
        <footer class="order-muted text-center text-sm">{{ copy.footer }}</footer>
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
