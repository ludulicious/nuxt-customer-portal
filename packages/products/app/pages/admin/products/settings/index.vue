<script setup lang="ts">
import type { z } from 'zod'
import type { settingsSchema } from '../../../../../shared/validation'

defineProps<{
  settings: z.output<typeof settingsSchema>
  health?: Awaited<ReturnType<ReturnType<typeof useProducts>['settings']>>
  saving: boolean
}>()
defineEmits<{ saveGeneral: [] }>()
</script>

<template>
  <ProductsGeneralSettings :model-value="settings" :health="health" :saving="saving" @save="$emit('saveGeneral')" />
</template>
