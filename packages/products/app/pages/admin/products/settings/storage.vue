<script setup lang="ts">
defineProps<{
  health?: Awaited<ReturnType<ReturnType<typeof useProducts>['settings']>>
}>()
defineEmits<{ changed: [] }>()
</script>

<template>
  <ProductsStorageSettings v-if="health" :storage="health.storage" @changed="$emit('changed')" />
</template>
