<script setup lang="ts">
const route = useRoute()
await navigateTo({ path: '/requests', query: route.query }, { replace: true })
</script>

<template>
  <div />
</template>
