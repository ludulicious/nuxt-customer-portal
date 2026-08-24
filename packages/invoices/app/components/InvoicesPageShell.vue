<script setup lang="ts">
withDefaults(defineProps<{ width?: 'default' | 'narrow' }>(), { width: 'default' })
</script>

<template>
  <main class="mx-auto w-full px-4 py-6 sm:px-6" :class="width === 'narrow' ? 'max-w-4xl' : 'max-w-7xl'"><slot /></main>
</template>
