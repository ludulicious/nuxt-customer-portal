<script setup lang="ts">
import type { PortalEmailSettings } from '../../../types/admin-email'
import EmailProviderSection from '../../../components/admin/email/EmailProviderSection.vue'
import EmailTemplateSection from '../../../components/admin/email/EmailTemplateSection.vue'
import EmailTextSection from '../../../components/admin/email/EmailTextSection.vue'

const { t } = useI18n()
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

const { data: settings, error } = await useFetch<PortalEmailSettings>('/api/admin/email')
if (error.value) {
  if (error.value.statusCode === 401) {
    await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
  } else {
    throw createError(error.value)
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
        <EmailProviderSection v-if="section === 'provider' && settings" :settings="settings" />
        <EmailTemplateSection v-else-if="section === 'template' && settings" :settings="settings" />
        <EmailTextSection v-else-if="section === 'text' && settings" :settings="settings" />
      </div>
    </div>
  </div>
</template>
