<script setup lang="ts">
import type { Purchase } from '../../shared/types'
import { formatMoney } from '../../shared/money'

defineProps<{
  purchase: Purchase
  files: Array<{ id: string; name: string; content_type: string; size: number }>
}>()
const open = defineModel<boolean>('open', { required: true })
const { t, locale } = useI18n()
const source = (orderId: string, assetId: string) => `/api/products/purchases/${orderId}/files/${assetId}`
</script>

<template>
  <UDrawer
    v-model:open="open"
    direction="right"
    :title="purchase.title"
    :description="purchase.bookingReference"
    close
    :ui="{ content: 'w-full sm:max-w-xl' }"
  >
    <template #body>
      <div class="space-y-5">
        <div class="rounded-lg border border-default bg-muted/20 p-4">
          <div class="flex flex-wrap items-center gap-3">
            <UBadge v-if="!purchase.access" color="error" variant="subtle">
              {{ t('products.accessRevoked') }}
            </UBadge>
            <UButton
              v-if="purchase.invoiceId"
              class="ml-auto"
              :to="`/invoices/${purchase.invoiceId}?from=orders`"
              icon="i-lucide-receipt-text"
              variant="outline"
              size="sm"
            >
              {{ t('products.viewInvoice') }}
            </UButton>
          </div>
          <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted">{{ t('products.amount') }}</dt>
              <dd class="mt-1 font-medium">{{ formatMoney(purchase.amount, purchase.currency, locale) }}</dd>
            </div>
            <div>
              <dt class="text-muted">{{ t('products.purchaseSortDate') }}</dt>
              <dd class="mt-1 font-medium">{{ new Date(purchase.createdAt).toLocaleDateString(locale) }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-muted">{{ t('products.bookingReference') }}</dt>
              <dd class="mt-1 font-mono text-xs">{{ purchase.bookingReference }}</dd>
            </div>
          </dl>
        </div>

        <section class="overflow-hidden rounded-lg border border-default bg-muted/20">
          <header class="border-b border-default px-4 py-3">
            <h2 class="font-semibold">{{ t('products.nextSteps') }}</h2>
          </header>
          <div class="space-y-2 p-4 text-sm">
            <UAlert v-if="purchase.disputed" color="error" variant="subtle" :title="t('products.disputed')" />
            <p v-if="purchase.type === 'service' && !purchase.planningEnabled" class="text-muted">
              {{ t(purchase.fulfilled ? 'products.fulfilled' : 'products.awaitingFulfillment') }}
            </p>
            <p class="whitespace-pre-line">{{ purchase.nextSteps }}</p>
          </div>
        </section>

        <section v-if="files.length" class="overflow-hidden rounded-lg border border-default bg-muted/20">
          <header class="border-b border-default px-4 py-3">
            <h2 class="font-semibold">{{ t('products.yourFiles') }}</h2>
          </header>
          <div class="grid gap-3 p-4 sm:grid-cols-2">
            <ProductsPurchasedFileCard
              v-for="file in files"
              :key="file.id"
              :file="file"
              :source="source(purchase.orderId, file.id)"
            />
          </div>
        </section>
      </div>
    </template>
  </UDrawer>
</template>
