<script setup lang="ts">
const route = useRoute()
const showFooter = computed(() => route.meta?.public === true)
</script>

<template>
  <div class="portal-layout min-h-screen">
    <div class="mx-auto w-full max-w-[1600px] px-4">
      <AppHeader />
    </div>

    <UMain class="main-content mx-auto w-full max-w-[1600px] px-4">
      <slot />
    </UMain>

    <div v-if="showFooter" class="mx-auto w-full max-w-[1600px] px-4">
      <div class="px-[clamp(1rem,4vw,4rem)]">
        <AppFooter />
      </div>
    </div>
  </div>
</template>
