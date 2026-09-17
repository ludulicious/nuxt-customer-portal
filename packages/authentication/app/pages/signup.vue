<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { AuthSessionResponse } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { ApiError } from '@nuxt-customer-portal/core/shared/types/index'

definePageMeta({
  layout: 'auth',
  public: true
})

const { t } = useI18n()

useSeoMeta({
  title: t('signup.title'),
  description: t('signup.title')
})

const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const portalAuth = runtimeConfig.public.portalAuth
const route = useRoute()
const clientConfiguration = useClientConfiguration()
const personalSignup = computed(
  () => Boolean(clientConfiguration.value.personalSelfRegistration) && !route.query.invitationId
)

const invitationId = useRoute().query.invitationId
if (
  portalAuth.registrationMode === 'disabled' ||
  (portalAuth.registrationMode === 'invitation-only' && !invitationId)
) {
  await navigateTo('/login')
}

const fields = computed(() => [
  ...(!invitationId
    ? [
        {
          name: 'firstName',
          type: 'text' as const,
          label: t('signup.fields.firstName'),
          autocomplete: 'given-name'
        },
        {
          name: 'lastName',
          type: 'text' as const,
          label: t('signup.fields.lastName'),
          autocomplete: 'family-name'
        }
      ]
    : []),
  {
    name: 'email',
    type: 'text' as const,
    label: t('signup.fields.email'),
    placeholder: t('signup.fields.emailPlaceholder'),
    autocomplete: 'email',
    ...(invitationId
      ? {
          defaultValue: invitationInfo.value?.email || '',
          readonly: true
        }
      : {})
  },
  {
    name: 'password',
    label: t('signup.fields.password'),
    type: 'password' as const,
    placeholder: t('signup.fields.passwordPlaceholder')
  }
])

const providers = computed(() =>
  [
    {
      enabled: portalAuth.googleEnabled,
      label: t('signup.providers.google'),
      icon: 'i-simple-icons-google',
      onClick: async () => {
        await handleGoogleLogin()
      }
    },
    {
      enabled: portalAuth.githubEnabled,
      label: t('signup.providers.github'),
      icon: 'i-simple-icons-github',
      onClick: async () => {
        await handleGitHubLogin()
      }
    }
  ].filter((provider) => provider.enabled)
)

const schema = computed(() => {
  const base = z.object({
    email: z.email(t('signup.validation.invalidEmail')),
    password: z.string().min(8, t('signup.validation.passwordMinLength'))
  })
  return invitationId
    ? base
    : base.extend({
        firstName: z.string().trim().min(1, t('signup.validation.nameRequired')).max(80),
        lastName: z.string().trim().min(1, t('signup.validation.nameRequired')).max(80)
      })
})

type Schema = {
  firstName?: string
  lastName?: string
  email: string
  password: string
}

const error = ref<string | null>(null)
const isLoading = ref(false)
const invitationInfo = ref<{ organizationName?: string; role?: string; email?: string } | null>(null)
const acceptingInvitation = ref(false)
const accountSwitchOpen = ref(false)
const switchingAccount = ref(false)

// User store for checking authentication
const userStore = useUserStore()
const { isAuthenticated, currentUser } = storeToRefs(userStore)

const fetchInvitationDetails = async (id: string) => {
  try {
    // Use custom endpoint to bypass inviter membership check
    const data = await $fetch<{
      organizationName?: string
      role?: string
      email?: string
    }>(`/api/organizations/get-invitation?id=${encodeURIComponent(id)}`)

    if (data) {
      invitationInfo.value = {
        organizationName: data.organizationName || undefined,
        role: data.role,
        email: data.email
      }
    }
  } catch (err) {
    console.error('Failed to fetch invitation details:', err)
  }
}

// Handle invitation acceptance for logged-in users
const handleLoggedInInvitation = async (invId: string) => {
  acceptingInvitation.value = true

  try {
    // Fetch invitation details using custom endpoint to bypass inviter membership check
    let invitationData: {
      email?: string
      role?: string
      organizationName?: string
      status?: string
      expiresAt?: Date | string
    } | null = null

    try {
      invitationData = await $fetch<{
        email?: string
        role?: string
        organizationName?: string
        status?: string
        expiresAt?: Date | string
      }>(`/api/organizations/get-invitation?id=${encodeURIComponent(invId)}`)
    } catch (fetchErr: unknown) {
      const apiError = fetchErr as { data?: { message?: string }; message?: string }
      const errorMessage =
        apiError?.data?.message ||
        apiError?.message ||
        t('signup.invitation.loggedIn.error', { error: 'Invitation not found' })
      error.value = errorMessage
      toast.add({
        title: t('common.error'),
        description: errorMessage,
        color: 'error'
      })
      acceptingInvitation.value = false
      return
    }

    if (!invitationData) {
      const errorMessage = t('signup.invitation.loggedIn.error', { error: 'Invitation not found' })
      error.value = errorMessage
      toast.add({
        title: t('common.error'),
        description: errorMessage,
        color: 'error'
      })
      acceptingInvitation.value = false
      return
    }

    invitationInfo.value = {
      organizationName: invitationData.organizationName,
      role: invitationData.role,
      email: invitationData.email
    }

    // Check if invitation email matches logged-in user's email
    const userEmail = currentUser.value?.email?.toLowerCase()
    const invitationEmail = invitationData.email?.toLowerCase()

    if (userEmail !== invitationEmail) {
      accountSwitchOpen.value = true
      acceptingInvitation.value = false
      return
    }

    // Accept the invitation using custom endpoint to bypass inviter membership check
    // This is necessary because admins who create organizations are removed as members
    try {
      const result = await $fetch<{ success: boolean; organization?: { id: string; name: string } }>(
        '/api/organizations/accept-invitation',
        {
          method: 'POST',
          body: { invitationId: invId }
        }
      )

      if (!result || !result.success) {
        throw new Error('Failed to accept invitation')
      }

      // Set the organization as active if user doesn't have an active organization
      const userStore = useUserStore()
      if (!userStore.activeOrganizationId && result.organization) {
        await userStore.setActiveOrganizationId(result.organization.id)
      }
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string }; message?: string }
      const errorMessage =
        apiError?.data?.message ||
        apiError?.message ||
        t('signup.invitation.loggedIn.error', { error: 'Unknown error' })
      error.value = errorMessage
      toast.add({
        title: t('common.error'),
        description: errorMessage,
        color: 'error'
      })
      acceptingInvitation.value = false
      return
    }

    // Success - show success message and redirect
    const successMessage = t('signup.invitation.loggedIn.success', {
      organizationName: invitationData.organizationName || 'the organization',
      role: invitationData.role || 'member'
    })
    toast.add({
      title: t('common.success'),
      description: successMessage,
      color: 'success'
    })

    localStorage.removeItem('pendingInvitationId')

    // Redirect to dashboard after short delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await navigateTo('/dashboard')
  } catch (err) {
    console.error('Error handling logged-in invitation:', err)
    const errorMessage = t('signup.invitation.loggedIn.error', {
      error: err instanceof Error ? err.message : 'Unknown error'
    })
    error.value = errorMessage
    toast.add({
      title: t('common.error'),
      description: errorMessage,
      color: 'error'
    })
  } finally {
    acceptingInvitation.value = false
  }
}

const switchAccount = async () => {
  switchingAccount.value = true
  try {
    await authClient.signOut()
    userStore.clearUserData()
    localStorage.setItem('pendingInvitationId', String(invitationId))
    window.location.assign(route.fullPath)
  } catch (err) {
    const apiError = err as ApiError
    toast.add({
      title: t('common.error'),
      description: apiError.message || t('signup.errors.unknownError'),
      color: 'error'
    })
    switchingAccount.value = false
  }
}

const onSubmit = async (payload: FormSubmitEvent<Schema>) => {
  console.log('Submitted', payload)
  error.value = null
  isLoading.value = true

  // Store invitation ID if present
  const invId = route.query.invitationId as string | undefined
  if (invId) {
    localStorage.setItem('pendingInvitationId', invId)
  }

  try {
    if (invId) {
      const result = await $fetch<{ success: boolean; organization: { id: string; name: string } }>(
        '/api/organizations/invitation-signup',
        {
          method: 'POST',
          body: {
            invitationId: invId,
            email: payload.data.email,
            password: payload.data.password
          }
        }
      )
      const signInResult = await authClient.signIn.email({
        email: payload.data.email,
        password: payload.data.password
      })
      if (signInResult.error) {
        throw new Error(signInResult.error.message || t('signup.errors.unknownError'))
      }
      localStorage.removeItem('pendingInvitationId')
      const session = await authClient.getSession()
      if (!session.data) {
        throw new Error(t('signup.errors.unknownError'))
      }
      await userStore.setSession(session.data as unknown as AuthSessionResponse)
      await userStore.setActiveOrganizationId(result.organization.id)
      await navigateTo('/dashboard')
      return
    }

    const response = await authClient.signUp.email({
      name: `${payload.data.firstName!} ${payload.data.lastName!}`,
      firstName: payload.data.firstName!,
      lastName: payload.data.lastName!,
      email: payload.data.email,
      password: payload.data.password
    })
    if (response.error) {
      const errorMessage = response.error.message || t('signup.errors.unknownError')
      error.value = errorMessage
      toast.add({ title: t('signup.errors.errorTitle'), description: errorMessage, color: 'error' })
    } else {
      // Redirect to OTP verification page with email parameter and invitation ID if present
      const personal = personalSignup.value
      const verifyUrl = `/verify-email?email=${encodeURIComponent(payload.data.email)}${personal ? '&redirect=%2Fpersonal-onboarding&purpose=personal' : ''}`
      navigateTo(verifyUrl)
    }
  } catch (err) {
    console.error('Email signup failed:', err)
    const apiError = err as ApiError
    const errorMessage = apiError.message || t('signup.errors.unknownError')
    error.value = errorMessage
    toast.add({ title: t('signup.errors.errorTitle'), description: errorMessage, color: 'error' })
  } finally {
    isLoading.value = false
  }
}
const invId = route.query.invitationId as string | undefined
if (invId) {
  // Check if user is already logged in
  if (isAuthenticated.value && currentUser.value) {
    // User is logged in, try to accept invitation automatically
    await handleLoggedInInvitation(invId)
  } else {
    // User is not logged in, store for later use
    localStorage.setItem('pendingInvitationId', invId)
    // Try to fetch invitation details to show context
    await fetchInvitationDetails(invId)
  }
}

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const socialLoginRedirect = computed(() => {
  if (invitationId) {
    return `/signup?invitationId=${encodeURIComponent(String(invitationId))}`
  }
  return personalSignup.value ? '/personal-onboarding' : route.query.redirect?.toString() || '/dashboard'
})
const handleGitHubLogin = async () => {
  loading.value = true
  errorMessage.value = null
  try {
    await signIn.social({ provider: 'github', callbackURL: socialLoginRedirect.value })
  } catch (error) {
    console.error('GitHub sign in initiation failed:', error)
    errorMessage.value = t('login.errors.githubError')
    loading.value = false
  }
}

const handleGoogleLogin = async () => {
  loading.value = true
  errorMessage.value = null
  try {
    await signIn.social({ provider: 'google', callbackURL: socialLoginRedirect.value })
  } catch (error) {
    console.error('Google sign in initiation failed:', error)
    errorMessage.value = t('login.errors.googleError')
    loading.value = false
  }
}
</script>

<template>
  <div>
    <UModal
      v-if="accountSwitchOpen"
      v-model:open="accountSwitchOpen"
      :title="t('signup.invitation.accountSwitch.title')"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <p class="text-sm text-muted">
          {{
            t('signup.invitation.accountSwitch.description', {
              currentEmail: currentUser?.email || '',
              invitationEmail: invitationInfo?.email || ''
            })
          }}
        </p>
      </template>
      <template #footer>
        <UButton color="neutral" variant="outline" :disabled="switchingAccount" @click="accountSwitchOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton icon="i-lucide-log-out" :loading="switchingAccount" @click="switchAccount">
          {{ t('signup.invitation.accountSwitch.confirm') }}
        </UButton>
      </template>
    </UModal>
    <UAlert v-if="errorMessage" color="error" :description="errorMessage" variant="outline" />
    <!-- Company Logo -->
    <div class="flex justify-center mb-8">
      <AppLogo class="w-auto h-8 shrink-0" />
    </div>

    <UAuthForm
      novalidate
      :fields="fields"
      :schema="schema"
      :providers="providers"
      :title="t(personalSignup ? 'personalRegistration' : 'signup.title')"
      :loading="loading"
      :submit="{ label: t('signup.submitButton') }"
      @submit="onSubmit"
    >
      <template #description>
        <span v-if="invitationId && providers.length" class="block">
          {{ t('signup.invitation.socialDescription', { email: invitationInfo?.email || '' }) }}
        </span>
        <span class="mt-2 block">
          {{ t('signup.description') }}
          <ULink to="/login" class="font-semibold text-primary underline underline-offset-4">
            {{ t('signup.loginLink') }}
          </ULink>
          .
        </span>
      </template>

      <template #footer>
        {{ t('signup.footer') }}
        <ULink :to="portalAuth.termsUrl" class="font-semibold text-primary underline underline-offset-4">
          {{ t('signup.termsLink') }}
        </ULink>
        .
      </template>
    </UAuthForm>
  </div>
</template>
