<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <UBadge color="warning" variant="solid" class="bg-amber-100 text-amber-950" icon="i-lucide-flask-conical">{{
    t('products.testOrder')
  }}</UBadge>
</template>
