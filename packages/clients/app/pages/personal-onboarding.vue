<script setup lang="ts">
import { z } from 'zod'
import { isValidTimezone } from '@nuxt-customer-portal/core/shared/timezone'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'

const { t, locale } = useI18n()
const config = useRuntimeConfig().public.clients
if (!config.personalSelfRegistration) {
  throw createError({ statusCode: 404 })
}
const { data: session } = await authClient.getSession()
const state = reactive({
  firstName: session?.user.firstName ?? '',
  lastName: session?.user.lastName ?? '',
  preferredLocale: (locale.value === 'nl' ? 'nl' : 'en') as 'nl' | 'en',
  timezone: null as string | null
})
onMounted(() => {
  state.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
})
const schema = computed(() =>
  z.object({
    firstName: z.string().trim().min(1, t('features.clients.validation.name')).max(80),
    lastName: z.string().trim().min(1, t('features.clients.validation.name')).max(80),
    preferredLocale: z.enum(['nl', 'en']),
    timezone: z
      .string()
      .nullable()
      .refine((value) => value === null || isValidTimezone(value), t('timezones.invalid'))
  })
)
const busy = ref(false)
const error = ref('')
const api = useClients()
const userStore = useUserStore()
const submit = async () => {
  busy.value = true
  error.value = ''
  try {
    const client = await api.onboard(state)
    await userStore.refreshOrganizations()
    await userStore.setActiveOrganizationId(client.id)
    await navigateTo('/dashboard')
  } catch {
    error.value = t('features.clients.onboardingFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl p-6">
    <h1 class="mb-4 text-2xl font-semibold">{{ t('features.clients.personalAccount') }}</h1>
    <UForm :schema="schema" :state="state" novalidate class="space-y-4" @submit="submit">
      <UFormField name="firstName" :label="t('features.clients.firstName')"
        ><UInput v-model="state.firstName" autocomplete="given-name" class="w-full"
      /></UFormField>
      <UFormField name="lastName" :label="t('features.clients.lastName')"
        ><UInput v-model="state.lastName" autocomplete="family-name" class="w-full"
      /></UFormField>
      <UFormField name="preferredLocale" :label="t('features.clients.locale')"
        ><USelect
          v-model="state.preferredLocale"
          :items="[
            { label: 'Nederlands', value: 'nl' },
            { label: 'English', value: 'en' }
          ]"
          value-key="value"
      /></UFormField>
      <UFormField name="timezone" :label="t('timezones.label')" :description="t('timezones.savedPreference')"
        ><PortalTimezoneSelect v-model="state.timezone"
      /></UFormField>
      <UAlert v-if="error" color="error" :title="error" />
      <UButton type="submit" :loading="busy">{{ t('features.clients.openPersonalAccount') }}</UButton>
    </UForm>
  </div>
</template>
