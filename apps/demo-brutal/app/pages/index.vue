<script setup lang="ts">
defineOptions({ name: 'BrutalHomePage' })
definePageMeta({ public: true })
</script>

<template>
  <section class="brutal-home">
    <p class="brutal-kicker">
      NUXT CUSTOMER PORTAL / SHELL 02
    </p>
    <h1>ONE CORE.<br>NO HOUSE STYLE.</h1>
    <p>The same authentication, organizations, service requests, and timesheets—composed as an unapologetically different host.</p>
    <UButton to="/dashboard" size="xl" trailing-icon="i-lucide-arrow-up-right">
      ENTER THE WORKBENCH
    </UButton>
  </section>
</template>
