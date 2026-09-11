<script setup lang="ts">
const route = useRoute()
await navigateTo(
  { path: `/admin/products/${route.params.id}`, query: { ...route.query, edit: 'true' } },
  { replace: true }
)
</script>

<template><div /></template>
