<script setup lang="ts">
import type { z } from 'zod'
import type { settingsSchema } from '../../../../../shared/validation'

defineProps<{
  settings: z.output<typeof settingsSchema>
  saving: boolean
}>()
defineEmits<{ saveStyles: [] }>()
</script>

<template>
  <ProductsStyleSettings :model-value="settings" :saving="saving" @save="$emit('saveStyles')" />
</template>
