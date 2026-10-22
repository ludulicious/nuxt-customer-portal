<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    class="bg-amber-50 text-amber-950 ring-amber-300"
    :ui="{ icon: 'text-amber-700', title: 'text-amber-950 font-semibold', description: 'text-amber-900' }"
    icon="i-lucide-flask-conical"
    :title="t('products.testOrder')"
    :description="t('products.testOrderHelp')"
  />
</template>
