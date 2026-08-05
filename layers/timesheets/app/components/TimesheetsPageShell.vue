<script setup lang="ts">
withDefaults(defineProps<{
  as?: string
  width?: 'wide' | 'narrow'
}>(), {
  as: 'div',
  width: 'wide'
})
</script>

<template>
  <component
    :is="as"
    data-timesheets-page-shell
    class="mx-auto w-full px-0 pt-2 pb-5 md:px-6 md:py-6 lg:px-8 lg:py-8"
    :class="width === 'narrow' ? 'max-w-6xl' : 'max-w-[1440px]'"
  >
    <slot />
  </component>
</template>
