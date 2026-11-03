<script setup lang="ts">
const route = useRoute()
const destinations: Record<string, string> = {
  provider: '/admin/portal-settings?settingsTab=email-provider',
  template: '/admin/portal-settings?settingsTab=email-template',
  text: '/admin/email-texts'
}
await navigateTo(destinations[String(route.params.section)] || destinations.provider!, { replace: true })
</script>

<template>
  <div />
</template>
