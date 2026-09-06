<script setup lang="ts">
const route = useRoute()
await navigateTo(
  { path: `/requests/${encodeURIComponent(String(route.params.id))}`, query: route.query },
  { replace: true }
)
</script>

<template>
  <div />
</template>
