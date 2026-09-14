<script setup lang="ts">
definePageMeta({ public: true, layout: 'store' })
const { t } = useI18n()
const sandbox = useRoute().query.sandbox as 'paid' | 'failed' | 'expired' | undefined
</script>

<template>
  <main class="mx-auto max-w-xl space-y-5 p-8">
    <p v-if="sandbox" class="text-right text-sm font-semibold text-red-700">{{ t('products.testCheckoutLabel') }}</p>
    <UIcon
      :name="sandbox === 'paid' ? 'i-lucide-circle-check' : sandbox ? 'i-lucide-circle-x' : 'i-lucide-mail-check'"
      class="size-12"
    />
    <h1 class="text-2xl font-semibold">{{ t(sandbox ? `products.sandboxResult${sandbox}` : 'products.thankYou') }}</h1>
    <p>{{ t(sandbox ? 'products.sandboxResultHelp' : 'products.paymentProcessing') }}</p>
    <UButton v-if="!sandbox || sandbox === 'paid'" to="/purchases">{{ t('products.purchases') }}</UButton>
  </main>
</template>
