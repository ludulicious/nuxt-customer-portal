<script setup lang="ts">
import { z } from 'zod'
import { settingsSchema } from '../../shared/validation'

const settings = defineModel<z.output<typeof settingsSchema>>({ required: true })
defineProps<{ saving: boolean }>()
const emit = defineEmits<{ save: [] }>()
const { t } = useI18n()
const schema = useProductFormSchema(
  z.object({
    markdownStyle: settingsSchema.shape.markdownStyle,
    checkoutAppearance: settingsSchema.shape.checkoutAppearance
  })
)
const colors = [
  'paperColor',
  'surfaceColor',
  'inkColor',
  'mutedColor',
  'displayColor',
  'accentColor',
  'actionColor',
  'focusColor',
  'borderColor'
] as const
</script>

<template>
  <UForm
    :state="settings"
    :schema="schema"
    novalidate
    class="space-y-4 rounded-lg border border-default p-5"
    @submit="emit('save')"
  >
    <fieldset class="space-y-4 rounded-md border p-4">
      <legend class="px-1 font-medium">{{ t('products.checkoutAppearance') }}</legend>
      <p class="text-sm text-muted">{{ t('products.checkoutAppearanceHelp') }}</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField name="checkoutAppearance.hostName" :label="t('products.hostName')">
          <UInput v-model="settings.checkoutAppearance.hostName" class="w-full" />
        </UFormField>
        <UFormField name="checkoutAppearance.logoUrl" :label="t('products.logoUrl')">
          <UInput v-model="settings.checkoutAppearance.logoUrl" type="url" class="w-full" />
        </UFormField>
        <UFormField name="checkoutAppearance.returnUrl" :label="t('products.returnUrl')">
          <UInput v-model="settings.checkoutAppearance.returnUrl" type="url" class="w-full" />
        </UFormField>
        <UFormField name="checkoutAppearance.radius" :label="t('products.cornerRadius')">
          <UInputNumber v-model="settings.checkoutAppearance.radius" :min="0" :max="40" class="w-full" />
        </UFormField>
        <UFormField name="checkoutAppearance.displayFontFamily" :label="t('products.displayFont')">
          <UInput v-model="settings.checkoutAppearance.displayFontFamily" class="w-full" />
        </UFormField>
        <UFormField name="checkoutAppearance.bodyFontFamily" :label="t('products.bodyFont')">
          <UInput v-model="settings.checkoutAppearance.bodyFontFamily" class="w-full" />
        </UFormField>
      </div>
      <UFormField name="checkoutAppearance.reassurance" :label="t('products.reassurance')">
        <UTextarea v-model="settings.checkoutAppearance.reassurance" class="w-full" />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UFormField
          v-for="color in colors"
          :key="color"
          :name="`checkoutAppearance.${color}`"
          :label="t(`products.${color}`)"
        >
          <div class="flex gap-2">
            <input v-model="settings.checkoutAppearance[color]" type="color" class="h-9 w-12 rounded border" />
            <UInput v-model="settings.checkoutAppearance[color]" class="min-w-0 flex-1" />
          </div>
        </UFormField>
      </div>
    </fieldset>
    <ProductsMarkdownSettings v-if="settings.markdownStyle" v-model="settings.markdownStyle" class="border-t-0 pt-0" />
    <UButton type="submit" :loading="saving">{{ t('products.save') }}</UButton>
  </UForm>
</template>
