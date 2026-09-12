<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { authClient, signIn } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { AuthSessionResponse } from '@nuxt-customer-portal/core/app/utils/auth-client'

const props = withDefaults(defineProps<{ redirectTo?: string; embedded?: boolean; redirectOnSuccess?: boolean }>(), {
  redirectTo: '/dashboard',
  embedded: false,
  redirectOnSuccess: true
})
const emit = defineEmits<{ success: [] }>()
const { t } = useI18n()
const portalAuth = useRuntimeConfig().public.portalAuth
const loading = ref(false)
const errorMessage = ref('')
const fields = computed(() => [
  { name: 'email', type: 'text' as const, label: t('login.fields.email'), required: true },
  { name: 'password', type: 'password' as const, label: t('login.fields.password') },
  { name: 'remember', type: 'checkbox' as const, label: t('login.fields.remember') }
])
const schema = computed(() =>
  z.object({
    email: z.email(t('login.validation.invalidEmail')),
    password: z.string().min(8, t('login.validation.passwordMinLength'))
  })
)
const forgotUrl = computed(() => `/forgot-password?redirect=${encodeURIComponent(props.redirectTo)}`)
const providers = computed(() =>
  [
    {
      enabled: portalAuth.googleEnabled,
      label: t('login.providers.google'),
      icon: 'i-simple-icons-google',
      provider: 'google'
    },
    {
      enabled: portalAuth.githubEnabled,
      label: t('login.providers.github'),
      icon: 'i-simple-icons-github',
      provider: 'github'
    }
  ]
    .filter((provider) => provider.enabled)
    .map((provider) => ({ ...provider, onClick: () => social(provider.provider as 'google' | 'github') }))
)

async function complete() {
  const pendingInvitationId = localStorage.getItem('pendingInvitationId')
  if (pendingInvitationId) {
    const result = await authClient.organization.acceptInvitation({ invitationId: pendingInvitationId })
    if (!result.error) {
      localStorage.removeItem('pendingInvitationId')
    }
  }
  if (props.redirectOnSuccess) {
    window.location.href = props.redirectTo
    return
  }
  const session = await authClient.getSession()
  emit('success')
  await useUserStore().setSession(session.data as unknown as AuthSessionResponse)
}

async function submit(payload: FormSubmitEvent<{ email: string; password: string; remember?: boolean }>) {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await signIn.email({ email: payload.data.email, password: payload.data.password })
    if (result.error) {
      if (result.error.message?.includes('Email not verified')) {
        await navigateTo(
          `/verify-email?email=${encodeURIComponent(payload.data.email)}&redirect=${encodeURIComponent(props.redirectTo)}&from=login`
        )
      } else {
        errorMessage.value = result.error.message || t('login.errors.invalidCredentials')
      }
      return
    }
    await complete()
  } catch {
    errorMessage.value = t('login.errors.unexpectedError')
  } finally {
    loading.value = false
  }
}

async function social(provider: 'google' | 'github') {
  loading.value = true
  errorMessage.value = ''
  try {
    await signIn.social({ provider, callbackURL: props.redirectTo })
  } catch {
    errorMessage.value = t(`login.errors.${provider}Error`)
    loading.value = false
  }
}
</script>

<template>
  <div :class="embedded ? 'checkout-sign-in' : ''">
    <UAlert v-if="errorMessage" color="error" :description="errorMessage" variant="outline" class="mb-4" />
    <UAuthForm
      :fields="fields"
      :schema="schema"
      :providers="providers"
      :title="embedded ? undefined : t('login.title')"
      :icon="embedded ? undefined : 'i-lucide-lock'"
      :loading="loading"
      :submit="{ label: t('login.submitButton') }"
      @submit="submit"
    >
      <template #password-hint>
        <ULink :to="forgotUrl" class="font-medium" tabindex="-1">{{ t('login.forgotPassword') }}</ULink>
      </template>
      <template v-if="!embedded" #footer>
        {{ t('login.footer') }}
        <ULink :to="portalAuth.termsUrl" class="font-medium">{{ t('login.termsLink') }}</ULink
        >.
      </template>
    </UAuthForm>
  </div>
</template>
