<template>
  <div class="min-h-screen">
    <div class="mx-auto max-w-6xl px-4"><AppHeader :show-navigation="false" /></div>
    <slot />
    <AppFooter />
  </div>
</template>
