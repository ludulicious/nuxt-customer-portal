<script setup lang="ts">
const route = useRoute()
</script>

<template><ProductsMediaEditorPage :batch="route.query.batch === '1'" /></template>
