<script setup lang="ts">
import { formatMoney } from '../../../shared/money'

const { t, locale } = useI18n(),
  api = useProducts(),
  orders = ref<Awaited<ReturnType<typeof api.purchases>>>([]),
  files = ref<Record<string, Awaited<ReturnType<typeof api.files>>>>({}),
  error = ref(''),
  loading = ref(true)
onMounted(async () => {
  try {
    orders.value = await api.purchases()
    for (const order of orders.value) {
      if (order.access && order.fileIds.length) {
        files.value[order.id] = await api.files(order.id)
      }
    }
  } catch {
    error.value = t('products.purchasesFailed')
  } finally {
    loading.value = false
  }
})
const source = (id: string, asset: string) => `/api/products/purchases/${id}/files/${asset}`
</script>

<template>
  <main class="mx-auto max-w-4xl space-y-6 p-6">
    <h1 class="text-2xl font-semibold">{{ t('products.purchases') }}</h1>
    <UAlert v-if="error" color="error" :title="error" />
    <p v-if="loading" role="status">{{ t('products.loading') }}</p>
    <p v-else-if="!orders.length">{{ t('products.noPurchases') }}</p>
    <article v-for="order in orders" :key="order.id" class="space-y-4 rounded-lg border p-5">
      <h2 class="text-xl font-semibold">{{ order.title }}</h2>
      <p class="text-sm text-muted">
        {{ formatMoney(order.amount, order.currency, locale) }} ·
        {{ new Date(order.createdAt).toLocaleDateString(locale) }}
      </p>
      <p v-if="order.disputed">{{ t('products.disputed') }}</p>
      <p v-else-if="!order.access">{{ t('products.accessRevoked') }}</p>
      <p v-if="order.type === 'service'">
        {{ t(order.fulfilled ? 'products.fulfilled' : 'products.awaitingFulfillment') }}
      </p>
      <p class="whitespace-pre-line">{{ order.nextSteps }}</p>
      <div v-for="file in files[order.id]" :key="file.id" class="space-y-2 border-t pt-3">
        <h3>{{ file.name }}</h3>
        <audio
          v-if="file.content_type.startsWith('audio/')"
          :src="source(order.id, file.id)"
          controls
          preload="none"
          class="w-full"
        /><video
          v-if="file.content_type.startsWith('video/')"
          :src="source(order.id, file.id)"
          controls
          preload="none"
          class="w-full rounded"
        /><UButton
          :href="`${source(order.id, file.id)}?download=1`"
          external
          variant="outline"
          icon="i-lucide-download"
          >{{ t('products.download') }}</UButton
        >
      </div>
      <UButton v-if="order.invoiceId" to="/invoices" variant="ghost">{{ t('products.invoice') }}</UButton>
    </article>
  </main>
</template>
