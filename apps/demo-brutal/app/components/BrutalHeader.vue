<script setup lang="ts">
const { modules } = useModuleNavigation()
const { currentUser } = usePortalSession()
</script>

<template>
  <header class="brutal-header">
    <NuxtLink to="/" class="brutal-wordmark">BRUTAL<br>WORKS</NuxtLink>
    <nav aria-label="Portal modules" class="brutal-modules"><NuxtLink v-for="module in modules" :key="module.id" :to="module.to">{{ module.label }}</NuxtLink></nav>
    <div class="brutal-account"><span>{{ currentUser?.name || 'GUEST' }}</span><AppUserMenu /></div>
  </header>
</template>
