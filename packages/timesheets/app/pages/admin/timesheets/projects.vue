<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtPage v-if="route.params.id" />
  <TimesheetsAdminSectionPage v-else section="projects" />
</template>
