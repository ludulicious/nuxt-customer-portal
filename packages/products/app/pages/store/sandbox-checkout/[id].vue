<script setup lang="ts">
import { formatMoney } from '../../../../shared/money'

definePageMeta({ public: true, layout: 'store' })
const { t } = useI18n()
const route = useRoute()
const busy = ref(false)
const error = ref('')
const checkout = await $fetch<{
  id: string
  status: string
  title: string
  amount: number
  currency: string
  email: string
}>(`/api/store/sandbox-checkout/${encodeURIComponent(String(route.params.id))}`)

async function finish(scenario: 'paid' | 'failed' | 'expired') {
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ url: string }>(`/api/store/sandbox-checkout/${encodeURIComponent(checkout.id)}`, {
      method: 'POST',
      body: { scenario }
    })
    await navigateTo(result.url, { external: true })
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message || t('products.sandboxCheckoutFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="mx-auto max-w-xl space-y-6 p-6">
    <UAlert
      color="warning"
      icon="i-lucide-flask-conical"
      :title="t('products.sandboxBanner')"
      :description="t('products.sandboxBannerHelp')"
    />
    <div class="space-y-4 rounded-lg border p-6">
      <div>
        <p class="text-sm text-muted">{{ t('products.sandboxCheckout') }}</p>
        <h1 class="text-2xl font-semibold">{{ checkout.title }}</h1>
      </div>
      <dl class="grid grid-cols-2 gap-2 text-sm">
        <dt class="text-muted">{{ t('products.email') }}</dt>
        <dd>{{ checkout.email }}</dd>
        <dt class="text-muted">{{ t('products.amount') }}</dt>
        <dd>{{ formatMoney(checkout.amount, checkout.currency) }}</dd>
      </dl>
      <UAlert v-if="error" color="error" :title="error" />
      <div class="grid gap-3 sm:grid-cols-3">
        <UButton :loading="busy" color="success" @click="finish('paid')">{{ t('products.simulatePaid') }}</UButton>
        <UButton :disabled="busy" color="error" variant="outline" @click="finish('failed')">{{
          t('products.simulateFailed')
        }}</UButton>
        <UButton :disabled="busy" color="neutral" variant="outline" @click="finish('expired')">{{
          t('products.simulateExpired')
        }}</UButton>
      </div>
    </div>
  </main>
</template>
