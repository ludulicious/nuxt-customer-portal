<script setup lang="ts">
const route = useRoute()
</script>

<template><ProductsMediaEditorPage :id="String(route.params.id)" :key="String(route.params.id)" /></template>
