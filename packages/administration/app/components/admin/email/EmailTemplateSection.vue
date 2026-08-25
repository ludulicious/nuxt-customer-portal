<script setup lang="ts">
import { z } from 'zod'
import type { PortalEmailSettings } from '../../../types/admin-email'

const props = defineProps<{ settings: PortalEmailSettings }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const state = reactive({ htmlTemplate: props.settings.htmlTemplate })
const usingProjectTemplate = ref(props.settings.usingProjectTemplate)
const schema = z.object({
  htmlTemplate: z.string().max(100_000).refine(
    (value) => ['subject', 'brand_name', 'body', 'footer', 'current_year'].every((key) => value.includes(`{{${key}}}`)),
    t('admin.email.validation.templatePlaceholders')
  )
})
const save = async () => {
  busy.value = true
  try {
    const result = await $fetch<PortalEmailSettings>('/api/admin/email/template', { method: 'PUT', body: { htmlTemplate: state.htmlTemplate || null } })
    state.htmlTemplate = result.htmlTemplate
    usingProjectTemplate.value = result.usingProjectTemplate
    toast.add({ title: t('admin.email.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.saveFailed'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
const reset = async () => {
  busy.value = true
  try {
    const result = await $fetch<PortalEmailSettings>('/api/admin/email/template', { method: 'DELETE' })
    state.htmlTemplate = result.htmlTemplate
    usingProjectTemplate.value = result.usingProjectTemplate
    toast.add({ title: t('admin.email.templateReset'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.saveFailed'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-6" @submit="save">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-semibold">{{ t('admin.email.template') }}</h2>
          <UBadge v-if="usingProjectTemplate" color="neutral" variant="subtle">{{ t('admin.email.projectDefault') }}</UBadge>
        </div>
      </template>
      <UFormField name="htmlTemplate">
        <UTextarea v-model="state.htmlTemplate" :rows="16" class="w-full font-mono text-xs" />
      </UFormField>
      <div class="mt-3 flex justify-end">
        <UButton type="button" color="neutral" variant="outline" icon="i-lucide-rotate-ccw" :loading="busy" @click="reset">{{ t('admin.email.resetTemplate') }}</UButton>
      </div>
    </UCard>
    <div class="flex justify-end"><UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('admin.email.saveTemplate') }}</UButton></div>
  </UForm>
</template>
