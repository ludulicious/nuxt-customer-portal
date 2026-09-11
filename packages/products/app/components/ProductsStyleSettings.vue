<script setup lang="ts">
import { z } from 'zod'
import { settingsSchema } from '../../shared/validation'

const settings = defineModel<z.output<typeof settingsSchema>>({ required: true })
defineProps<{ saving: boolean }>()
const emit = defineEmits<{ save: [] }>()
const { t } = useI18n()
const schema = useProductFormSchema(z.object({ markdownStyle: settingsSchema.shape.markdownStyle }))
</script>

<template>
  <UForm
    :state="settings"
    :schema="schema"
    novalidate
    class="space-y-4 rounded-lg border border-default p-5"
    @submit="emit('save')"
  >
    <ProductsMarkdownSettings v-if="settings.markdownStyle" v-model="settings.markdownStyle" class="border-t-0 pt-0" />
    <UButton type="submit" :loading="saving">{{ t('products.save') }}</UButton>
  </UForm>
</template>
