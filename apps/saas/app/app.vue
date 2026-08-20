<script setup lang="ts">
const config = useRuntimeConfig()
useHead({
  titleTemplate: title => title ? `${title} / Customer Portal SaaS` : 'Customer Portal SaaS',
  htmlAttrs: { lang: 'en' }
})

</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
