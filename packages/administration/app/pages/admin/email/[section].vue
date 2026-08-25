<script setup lang="ts">
import { z } from 'zod'
import type {
  PortalEmailDefinition,
  PortalEmailLocale,
  PortalEmailText
} from '@nuxt-customer-portal/core/shared/types/feature'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const { isAdmin } = storeToRefs(useUserStore())
if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: t('admin.errors.accessRequired') })
}
useSeoMeta({ title: () => t('admin.email.title') })

const section = computed(() => String(route.params.section))
const sections = computed(() => [
  {
    label: t('admin.email.providerPage'),
    icon: 'i-lucide-server-cog',
    to: '/admin/email/provider',
    active: section.value === 'provider'
  },
  {
    label: t('admin.email.templatePage'),
    icon: 'i-lucide-layout-template',
    to: '/admin/email/template',
    active: section.value === 'template'
  },
  {
    label: t('admin.email.textPage'),
    icon: 'i-lucide-text-cursor-input',
    to: '/admin/email/text',
    active: section.value === 'text'
  }
])

if (!['provider', 'template', 'text'].includes(section.value)) {
  await navigateTo('/admin/email/provider', { replace: true })
}

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
const { data: settings, error: settingsError } = await useFetch<Settings>('/api/admin/email')
if (settingsError.value) {
  if (settingsError.value.statusCode === 401) {
    await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
  } else {
    throw createError(settingsError.value)
  }
}
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
  { label: 'English', value: 'en' as const },
  { label: 'Nederlands', value: 'nl' as const }
])
const placeholderToken = (key: string) => `{{${key}}}`
const providerSchema = z.object({
  apiKey: z.string().refine((value) => !value || value.trim().length >= 8, t('admin.email.validation.apiKey')),
  fromName: z.string().trim().max(200),
  fromEmail: z.string().trim().email(t('admin.email.validation.fromEmail')).max(320),
  defaultLocale: z.enum(['en', 'nl'])
})
const templateSchema = z.object({
  htmlTemplate: z
    .string()
    .max(100_000)
    .refine(
      (value) => ['subject', 'brand_name', 'body', 'footer', 'current_year'].every((key) => value.includes(`{{${key}}}`)),
      t('admin.email.validation.templatePlaceholders')
    )
})
const textSchema = z.object({
  subject: z.string().trim().min(1, t('admin.email.validation.subject')).max(500),
  body: z.string().trim().min(1, t('admin.email.validation.body')).max(50_000),
  footer: z.string().max(10_000).optional()
})
const sectionSchema = computed(() =>
  section.value === 'provider' ? providerSchema : section.value === 'template' ? templateSchema : textSchema
)
const sectionFormState = computed(() => (section.value === 'text' ? selectedText.value : draft))

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
    const request =
      section.value === 'provider'
        ? {
            url: '/api/admin/email/provider',
            body: {
              apiKey: draft.apiKey || undefined,
              fromName: draft.fromName,
              fromEmail: draft.fromEmail,
              defaultLocale: draft.defaultLocale
            }
          }
        : section.value === 'template'
          ? { url: '/api/admin/email/template', body: { htmlTemplate: draft.htmlTemplate || null } }
          : {
              url: `/api/admin/email/texts/${encodeURIComponent(selectedItem.value!.moduleId)}/${encodeURIComponent(selectedItem.value!.definition.id)}/${selectedLocale.value}`,
              body: { definition: selectedItem.value!.definition, text: selectedText.value }
            }
    settings.value = await $fetch(request.url, {
      method: 'PUT',
      body: request.body
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
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header class="flex items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
          <div class="flex min-w-0 gap-3">
            <UIcon name="i-lucide-mail" class="mt-1 size-6 shrink-0 text-primary" />
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold text-highlighted">{{ t('admin.email.title') }}</h1>
              <p class="hidden text-sm text-muted sm:block">{{ t('admin.email.description') }}</p>
            </div>
          </div>
        </header>
      <nav class="flex flex-wrap gap-2" :aria-label="t('admin.email.sections')">
        <UButton
          v-for="item in sections"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :color="item.active ? 'primary' : 'neutral'"
          :variant="item.active ? 'soft' : 'ghost'"
        >
          {{ item.label }}
        </UButton>
      </nav>
      <UForm :schema="sectionSchema" :state="sectionFormState" class="space-y-6" @submit="save">
        <UCard v-if="section === 'provider'">
        <template #header
          ><h2 class="font-semibold">{{ t('admin.email.provider') }}</h2></template
        >
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField
            name="apiKey"
            :label="
              settings?.configured
                ? t('admin.email.replaceKey', { suffix: settings.keyLastFour })
                : t('admin.email.apiKey')
            "
            ><UInput v-model="draft.apiKey" type="password" autocomplete="new-password" class="w-full"
          /></UFormField>
          <UFormField name="fromName" :label="t('admin.email.fromName')"><UInput v-model="draft.fromName" class="w-full" /></UFormField>
          <UFormField name="fromEmail" :label="t('admin.email.fromEmail')"
            ><UInput v-model="draft.fromEmail" type="email" class="w-full"
          /></UFormField>
          <UFormField name="defaultLocale" :label="t('admin.email.defaultLocale')"
            ><USelect v-model="draft.defaultLocale" :items="localeOptions" class="w-full"
          /></UFormField>
        </div>
        <UButton
          type="button"
          class="mt-4"
          color="neutral"
          variant="outline"
          icon="i-lucide-badge-check"
          :loading="busy"
          @click="checkProvider"
          >{{ t('admin.email.validateProvider') }}</UButton
        >
        </UCard>
        <UCard v-if="section === 'template'">
        <template #header
          ><div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold">{{ t('admin.email.template') }}</h2>
            <UBadge v-if="settings?.usingProjectTemplate" color="neutral" variant="subtle">{{
              t('admin.email.projectDefault')
            }}</UBadge>
          </div></template
        >
        <UFormField name="htmlTemplate">
          <UTextarea v-model="draft.htmlTemplate" :rows="16" class="w-full font-mono text-xs" />
        </UFormField>
        <div class="mt-3 flex justify-end">
          <UButton type="button" color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="resetTemplate">{{
            t('admin.email.resetTemplate')
          }}</UButton>
        </div>
        </UCard>
      <UCard v-if="section === 'text' && selectedItem">
        <template #header
          ><h2 class="font-semibold">{{ t('admin.email.texts') }}</h2></template
        >
        <div class="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav class="space-y-1" :aria-label="t('admin.email.messageNavigation')">
            <UButton
              v-for="item in messageOptions"
              :key="item.value"
              type="button"
              block
              :label="item.label"
              :color="selected === item.value ? 'primary' : 'neutral'"
              :variant="selected === item.value ? 'soft' : 'ghost'"
              class="justify-start"
              @click="selected = item.value"
            />
          </nav>
          <div class="space-y-4">
            <div class="flex gap-2" role="group" :aria-label="t('admin.email.languageNavigation')">
              <UButton
                v-for="locale in localeOptions"
                :key="locale.value"
                type="button"
                :label="locale.label"
                :color="selectedLocale === locale.value ? 'primary' : 'neutral'"
                :variant="selectedLocale === locale.value ? 'soft' : 'outline'"
                @click="selectedLocale = locale.value"
              />
            </div>
          <UFormField name="subject" :label="t('admin.email.subject')"
            ><UInput
              :model-value="selectedText.subject"
              class="w-full"
              @update:model-value="selectedText = { ...selectedText, subject: String($event) }"
          /></UFormField>
          <UFormField name="body" :label="t('admin.email.body')"
            ><UTextarea
              :model-value="selectedText.body"
              :rows="8"
              class="w-full font-mono text-xs"
              @update:model-value="selectedText = { ...selectedText, body: String($event) }"
          /></UFormField>
          <UFormField name="footer" :label="t('admin.email.footer')"
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
            <UButton type="button" color="neutral" variant="outline" icon="i-lucide-eye" @click="preview">{{
              t('admin.email.preview')
            }}</UButton
            ><UInput v-model="testAddress" type="email" :placeholder="t('admin.email.testAddress')" /><UButton
              type="button"
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
        </div>
        </UCard>
        <div class="flex justify-end">
          <UButton type="submit" icon="i-lucide-save" :loading="busy">
            {{
              section === 'provider'
                ? t('admin.email.saveProvider')
                : section === 'template'
                  ? t('admin.email.saveTemplate')
                  : t('admin.email.saveText')
            }}
          </UButton>
        </div>
      </UForm>
      </div>
    </div>
  </div>
</template>
