<script setup lang="ts">
const props = defineProps<{ component: string }>()
const resolvedComponent = resolveComponent(props.component)
</script>

<template>
  <component :is="resolvedComponent" />
</template>
