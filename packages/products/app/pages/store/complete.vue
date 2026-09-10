<script setup lang="ts">
definePageMeta({ public: true, layout: 'store' })
const { t } = useI18n()
</script>

<template>
  <main class="mx-auto max-w-xl space-y-5 p-8">
    <UIcon name="i-lucide-mail-check" class="size-12" />
    <h1 class="text-2xl font-semibold">{{ t('products.thankYou') }}</h1>
    <p>{{ t('products.paymentProcessing') }}</p>
    <UButton to="/purchases">{{ t('products.purchases') }}</UButton>
  </main>
</template>
