<script setup lang="ts">
const props = defineProps<{
  class?: string
  ui?: {
    root?: string
    base?: string
  }
}>()
</script>

<template>
  <div
    role="group"
    aria-label="Scrollable documentation table"
    tabindex="0"
    :class="[
      'relative my-5 overflow-x-auto rounded-md outline-primary/25 focus-visible:outline-3',
      props.ui?.root,
      props.class
    ]"
  >
    <table :class="['w-full border-separate border-spacing-0 rounded-md', props.ui?.base]">
      <slot />
    </table>
  </div>
</template>
