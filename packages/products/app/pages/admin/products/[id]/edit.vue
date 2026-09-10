<script setup lang="ts">
definePageMeta({ key: (route) => route.path })
const route = useRoute()
</script>

<template>
  <ProductsEditorPage :key="String(route.params.id)" :product-id="String(route.params.id)" />
</template>
