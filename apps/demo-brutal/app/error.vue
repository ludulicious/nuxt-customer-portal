<script setup lang="ts">
import type { NuxtError } from '#app'

defineOptions({ name: 'BrutalErrorPage' })
defineProps<{ error: NuxtError }>()
</script>

<template>
  <div class="brutal-error">
    <p>ROUTE FAILURE</p>
    <h1>{{ error.statusCode }}</h1>
    <p>{{ error.statusMessage }}</p>
    <UButton to="/">
      RETURN HOME
    </UButton>
  </div>
</template>
