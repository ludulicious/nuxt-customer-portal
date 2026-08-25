<script setup lang="ts">
import type {
  PortalEmailDefinition,
  PortalEmailLocale,
  PortalEmailText
} from '@nuxt-customer-portal/core/shared/types/feature'

const { t } = useI18n()
const toast = useToast()
const { isAdmin } = storeToRefs(useUserStore())
if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: t('admin.errors.accessRequired') })
}
useSeoMeta({ title: () => t('admin.email.title') })

type Settings = {
  configured: boolean
  keyLastFour: string | null
  fromName: string
  fromEmail: string
  defaultLocale: PortalEmailLocale
  htmlTemplate: string
  usingProjectTemplate: boolean
  textOverrides: Record<string, Partial<PortalEmailText>>
  updatedAt: string | null
}
type CatalogItem = { moduleId: string; definition: PortalEmailDefinition }
const { features } = usePortalFeatures()
const catalog = computed<CatalogItem[]>(() =>
  features.value.flatMap((feature) =>
    (feature.emails ?? []).map((definition) => ({ moduleId: feature.id, definition }))
  )
)
const { data: settings } = await useFetch<Settings>('/api/admin/email')
const draft = reactive({
  apiKey: '',
  fromName: '',
  fromEmail: '',
  defaultLocale: 'en' as PortalEmailLocale,
  htmlTemplate: '',
  textOverrides: {} as Record<string, Partial<PortalEmailText>>
})
const selected = ref(0)
const selectedLocale = ref<PortalEmailLocale>('en')
const previewHtml = ref('')
const testAddress = ref('')
const busy = ref(false)
const selectedItem = computed(() => catalog.value[selected.value] ?? catalog.value[0])
const overrideKey = computed(() =>
  selectedItem.value ? `${selectedItem.value.moduleId}.${selectedItem.value.definition.id}.${selectedLocale.value}` : ''
)
const selectedText = computed({
  get: () => {
    const item = selectedItem.value
    if (!item) {
      return { subject: '', body: '', footer: '' }
    }
    return { ...item.definition.defaults[selectedLocale.value], ...draft.textOverrides[overrideKey.value] }
  },
  set: (value: PortalEmailText) => {
    draft.textOverrides[overrideKey.value] = value
  }
})
const messageOptions = computed(() =>
  catalog.value.map((item, index) => ({ label: t(item.definition.labelKey), value: index }))
)
const localeOptions = computed(() => [
  { label: 'English', value: 'en' },
  { label: 'Nederlands', value: 'nl' }
])
const placeholderToken = (key: string) => `{{${key}}}`

watch(
  settings,
  (value) => {
    if (!value) {
      return
    }
    Object.assign(draft, {
      apiKey: '',
      fromName: value.fromName,
      fromEmail: value.fromEmail,
      defaultLocale: value.defaultLocale,
      htmlTemplate: value.htmlTemplate,
      textOverrides: structuredClone(value.textOverrides)
    })
  },
  { immediate: true }
)

const save = async () => {
  busy.value = true
  try {
    settings.value = await $fetch('/api/admin/email', {
      method: 'PUT',
      body: {
        ...draft,
        apiKey: draft.apiKey || undefined,
        htmlTemplate: draft.htmlTemplate || null,
        definitions: catalog.value
      }
    })
    toast.add({ title: t('admin.email.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.saveFailed'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const resetTemplate = async () => {
  settings.value = await $fetch('/api/admin/email/template', { method: 'DELETE' })
  toast.add({ title: t('admin.email.templateReset'), color: 'success' })
}
const messagePayload = () => ({
  moduleId: selectedItem.value!.moduleId,
  definition: selectedItem.value!.definition,
  locale: selectedLocale.value,
  text: selectedText.value,
  htmlTemplate: draft.htmlTemplate
})
const preview = async () => {
  const result = await $fetch<{ html: string }>('/api/admin/email/preview', { method: 'POST', body: messagePayload() })
  previewHtml.value = result.html
}
const sendTest = async () => {
  busy.value = true
  try {
    await $fetch('/api/admin/email/test', { method: 'POST', body: { ...messagePayload(), to: testAddress.value } })
    toast.add({ title: t('admin.email.testSent'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.testFailed'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const checkProvider = async () => {
  busy.value = true
  try {
    const result = await $fetch<{ verifiedDomains: string[] }>('/api/admin/email/provider')
    toast.add({
      title: t('admin.email.providerValid'),
      description: result.verifiedDomains.join(', '),
      color: 'success'
    })
  } catch (error) {
    toast.add({ title: t('admin.email.providerInvalid'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header class="border-b border-default pb-4">
        <h1 class="text-2xl font-semibold text-highlighted">{{ t('admin.email.title') }}</h1>
        <p class="text-sm text-muted">{{ t('admin.email.description') }}</p>
      </header>
      <UCard>
        <template #header
          ><h2 class="font-semibold">{{ t('admin.email.provider') }}</h2></template
        >
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField
            :label="
              settings?.configured
                ? t('admin.email.replaceKey', { suffix: settings.keyLastFour })
                : t('admin.email.apiKey')
            "
            ><UInput v-model="draft.apiKey" type="password" autocomplete="new-password" class="w-full"
          /></UFormField>
          <UFormField :label="t('admin.email.fromName')"><UInput v-model="draft.fromName" class="w-full" /></UFormField>
          <UFormField :label="t('admin.email.fromEmail')"
            ><UInput v-model="draft.fromEmail" type="email" class="w-full"
          /></UFormField>
          <UFormField :label="t('admin.email.defaultLocale')"
            ><USelect v-model="draft.defaultLocale" :items="localeOptions" class="w-full"
          /></UFormField>
        </div>
        <UButton
          class="mt-4"
          color="neutral"
          variant="outline"
          icon="i-lucide-badge-check"
          :loading="busy"
          @click="checkProvider"
          >{{ t('admin.email.validateProvider') }}</UButton
        >
      </UCard>
      <UCard>
        <template #header
          ><div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold">{{ t('admin.email.template') }}</h2>
            <UBadge v-if="settings?.usingProjectTemplate" color="neutral" variant="subtle">{{
              t('admin.email.projectDefault')
            }}</UBadge>
          </div></template
        >
        <UTextarea v-model="draft.htmlTemplate" :rows="16" class="w-full font-mono text-xs" />
        <div class="mt-3 flex justify-end">
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="resetTemplate">{{
            t('admin.email.resetTemplate')
          }}</UButton>
        </div>
      </UCard>
      <UCard v-if="selectedItem">
        <template #header
          ><h2 class="font-semibold">{{ t('admin.email.texts') }}</h2></template
        >
        <div class="grid gap-3 md:grid-cols-2">
          <USelect v-model="selected" :items="messageOptions" /><USelect
            v-model="selectedLocale"
            :items="localeOptions"
          />
        </div>
        <div class="mt-4 space-y-4">
          <UFormField :label="t('admin.email.subject')"
            ><UInput
              :model-value="selectedText.subject"
              class="w-full"
              @update:model-value="selectedText = { ...selectedText, subject: String($event) }"
          /></UFormField>
          <UFormField :label="t('admin.email.body')"
            ><UTextarea
              :model-value="selectedText.body"
              :rows="8"
              class="w-full font-mono text-xs"
              @update:model-value="selectedText = { ...selectedText, body: String($event) }"
          /></UFormField>
          <UFormField :label="t('admin.email.footer')"
            ><UTextarea
              :model-value="selectedText.footer"
              :rows="3"
              class="w-full"
              @update:model-value="selectedText = { ...selectedText, footer: String($event) }"
          /></UFormField>
          <p class="text-xs text-muted">
            {{ t('admin.email.placeholders.title') }}:
            <code v-for="placeholder in selectedItem.definition.placeholders" :key="placeholder.key" class="mr-2">{{
              placeholderToken(placeholder.key)
            }}</code>
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" icon="i-lucide-eye" @click="preview">{{
              t('admin.email.preview')
            }}</UButton
            ><UInput v-model="testAddress" type="email" :placeholder="t('admin.email.testAddress')" /><UButton
              icon="i-lucide-send"
              :disabled="!testAddress"
              :loading="busy"
              @click="sendTest"
              >{{ t('admin.email.sendTest') }}</UButton
            >
          </div>
          <iframe
            v-if="previewHtml"
            :srcdoc="previewHtml"
            sandbox=""
            class="h-[520px] w-full rounded-lg border border-default bg-white"
            :title="t('admin.email.preview')"
          />
        </div>
      </UCard>
      <UButton block icon="i-lucide-save" :loading="busy" @click="save">{{ t('admin.email.save') }}</UButton>
    </div>
  </div>
</template>
