<script setup lang="ts">
import { z } from 'zod'
import type { PortalEmailDefinition, PortalEmailLocale, PortalEmailText } from '@nuxt-customer-portal/core/shared/types/feature'
import type { PortalEmailSettings } from '../../../types/admin-email'

const props = defineProps<{ settings: PortalEmailSettings }>()
const { t } = useI18n()
const toast = useToast()
const { features } = usePortalFeatures()
const catalog = computed<Array<{ moduleId: string; definition: PortalEmailDefinition }>>(() =>
  features.value.flatMap((feature) => (feature.emails ?? []).map((definition) => ({ moduleId: feature.id, definition })))
)
const overrides = reactive(structuredClone(props.settings.textOverrides))
const selected = ref(0)
const selectedLocale = ref<PortalEmailLocale>('en')
const previewHtml = ref('')
const testAddress = ref('')
const busy = ref(false)
const selectedItem = computed(() => catalog.value[selected.value] ?? catalog.value[0])
const overrideKey = computed(() => selectedItem.value ? `${selectedItem.value.moduleId}.${selectedItem.value.definition.id}.${selectedLocale.value}` : '')
const selectedText = computed<PortalEmailText>({
  get: () => selectedItem.value ? { ...selectedItem.value.definition.defaults[selectedLocale.value], ...overrides[overrideKey.value] } : { subject: '', body: '', footer: '' },
  set: (value) => { overrides[overrideKey.value] = value }
})
const messages = computed(() => catalog.value.map((item, index) => ({ label: t(item.definition.labelKey), value: index })))
const locales = [
  { label: 'English', value: 'en' as const },
  { label: 'Nederlands', value: 'nl' as const }
]
const schema = z.object({
  subject: z.string().trim().min(1, t('admin.email.validation.subject')).max(500),
  body: z.string().trim().min(1, t('admin.email.validation.body')).max(50_000),
  footer: z.string().max(10_000).optional()
})
const placeholderToken = (key: string) => `{{${key}}}`
const payload = () => ({ moduleId: selectedItem.value!.moduleId, definition: selectedItem.value!.definition, locale: selectedLocale.value, text: selectedText.value, htmlTemplate: props.settings.htmlTemplate })
const save = async () => {
  busy.value = true
  try {
    const item = selectedItem.value!
    const result = await $fetch<PortalEmailSettings>(`/api/admin/email/texts/${encodeURIComponent(item.moduleId)}/${encodeURIComponent(item.definition.id)}/${selectedLocale.value}`, { method: 'PUT', body: { definition: item.definition, text: selectedText.value } })
    Object.assign(overrides, result.textOverrides)
    toast.add({ title: t('admin.email.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.saveFailed'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
const preview = async () => {
  try {
    previewHtml.value = (await $fetch<{ html: string }>('/api/admin/email/preview', { method: 'POST', body: payload() })).html
  } catch (error) {
    toast.add({ title: t('admin.email.saveFailed'), description: String(error), color: 'error' })
  }
}
const sendTest = async () => {
  busy.value = true
  try {
    await $fetch('/api/admin/email/test', { method: 'POST', body: { ...payload(), to: testAddress.value } })
    toast.add({ title: t('admin.email.testSent'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.testFailed'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
</script>

<template>
  <UForm v-if="selectedItem" :schema="schema" :state="selectedText" class="space-y-6" @submit="save">
    <UCard>
      <template #header><h2 class="font-semibold">{{ t('admin.email.texts') }}</h2></template>
      <div class="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav class="space-y-1" :aria-label="t('admin.email.messageNavigation')">
          <UButton v-for="item in messages" :key="item.value" type="button" block :label="item.label" :color="selected === item.value ? 'primary' : 'neutral'" :variant="selected === item.value ? 'soft' : 'ghost'" class="justify-start" @click="selected = item.value" />
        </nav>
        <div class="space-y-4">
          <div class="flex gap-2" role="group" :aria-label="t('admin.email.languageNavigation')">
            <UButton v-for="locale in locales" :key="locale.value" type="button" :label="locale.label" :color="selectedLocale === locale.value ? 'primary' : 'neutral'" :variant="selectedLocale === locale.value ? 'soft' : 'outline'" @click="selectedLocale = locale.value" />
          </div>
          <UFormField name="subject" :label="t('admin.email.subject')"><UInput :model-value="selectedText.subject" class="w-full" @update:model-value="selectedText = { ...selectedText, subject: String($event) }" /></UFormField>
          <UFormField name="body" :label="t('admin.email.body')"><UTextarea :model-value="selectedText.body" :rows="8" class="w-full font-mono text-xs" @update:model-value="selectedText = { ...selectedText, body: String($event) }" /></UFormField>
          <UFormField name="footer" :label="t('admin.email.footer')"><UTextarea :model-value="selectedText.footer" :rows="3" class="w-full" @update:model-value="selectedText = { ...selectedText, footer: String($event) }" /></UFormField>
          <p class="text-xs text-muted">{{ t('admin.email.placeholders.title') }}: <code v-for="placeholder in selectedItem.definition.placeholders" :key="placeholder.key" class="mr-2">{{ placeholderToken(placeholder.key) }}</code></p>
          <div class="flex flex-wrap gap-2">
            <UButton type="button" color="neutral" variant="outline" icon="i-lucide-eye" @click="preview">{{ t('admin.email.preview') }}</UButton>
            <UInput v-model="testAddress" type="email" :placeholder="t('admin.email.testAddress')" />
            <UButton type="button" icon="i-lucide-send" :disabled="!testAddress" :loading="busy" @click="sendTest">{{ t('admin.email.sendTest') }}</UButton>
          </div>
          <iframe v-if="previewHtml" :srcdoc="previewHtml" sandbox="" class="h-[520px] w-full rounded-lg border border-default bg-white" :title="t('admin.email.preview')" />
        </div>
      </div>
    </UCard>
    <div class="flex justify-end"><UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('admin.email.saveText') }}</UButton></div>
  </UForm>
</template>
