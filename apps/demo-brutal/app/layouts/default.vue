<script setup lang="ts">
defineOptions({ name: 'BrutalDefaultLayout' })

const { activeModule, activeModuleMenuItems } = useModuleNavigation()
</script>

<template>
  <div class="brutal-shell">
    <BrutalHeader />
    <aside v-if="activeModule" class="brutal-context">
      <p>ACTIVE DESK</p>
      <h2>{{ activeModule.label }}</h2>
      <UNavigationMenu :items="activeModuleMenuItems" orientation="vertical" />
    </aside>
    <main class="brutal-main">
      <slot />
    </main>
  </div>
</template>
