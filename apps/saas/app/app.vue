<script setup lang="ts">
const config = useRuntimeConfig()
useHead({
  titleTemplate: title => title ? `${title} / Customer Portal SaaS` : 'Customer Portal SaaS',
  htmlAttrs: { lang: 'en' },
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon-light.png', media: '(prefers-color-scheme: light)' },
    { rel: 'icon', type: 'image/png', href: '/favicon-dark.png', media: '(prefers-color-scheme: dark)' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
  ]
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
