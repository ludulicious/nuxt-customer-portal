<script setup lang="ts">
defineOptions({ name: 'BrutalDefaultLayout' })

const sidebarOpen = ref(false)
const isDesktop = useMediaQuery('(min-width: 64rem)')

watch(isDesktop, (desktop) => {
  sidebarOpen.value = desktop
}, { immediate: true })
</script>

<template>
  <div class="brutal-shell" :data-sidebar-open="sidebarOpen">
    <BrutalHeader :sidebar-open="sidebarOpen" @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <BrutalSidebar v-model:open="sidebarOpen" />
    <button v-if="sidebarOpen && !isDesktop" type="button" class="brutal-sidebar-scrim" aria-label="Close navigation" @click="sidebarOpen = false" />
    <main class="brutal-main">
      <slot />
    </main>
  </div>
</template>
