<script setup lang="ts">
const props = defineProps<{
  health?: Awaited<ReturnType<ReturnType<typeof useProducts>['settings']>>
}>()
defineEmits<{ changed: [] }>()

watchEffect(() => {
  if (props.health?.stripe.source === 'environment') {
    navigateTo('/admin/products/settings', { replace: true })
  }
})
</script>

<template>
  <ProductsStripeSettings
    v-if="health && health.stripe.source !== 'environment'"
    :stripe="health.stripe"
    @changed="$emit('changed')"
  />
</template>
