<script setup lang="ts">
import type { NuxtError } from '#app'

defineOptions({ name: 'SaasErrorPage' })
const props = defineProps<{ error: NuxtError }>()
const colorMode = useColorMode()

const isNotFound = computed(() => props.error.statusCode === 404)
const errorThemeClass = computed(() => colorMode.value === 'light' ? 'saas-error--light' : 'saas-error--dark')
const clearAndGoHome = () => clearError({ redirect: '/' })
</script>

<template>
  <UApp>
    <main :class="['saas-error', errorThemeClass]">
      <div class="saas-error__brand">
        <PortalLogoMark />
        <div>
          <p class="saas-error__wordmark">Nuxt Customer Portal</p>
          <p class="saas-error__tagline">Platform</p>
        </div>
      </div>

      <section class="saas-error__content" aria-labelledby="error-title">
        <p class="saas-error__eyebrow">{{ isNotFound ? '404 · Page not found' : `${props.error.statusCode} · Something went wrong` }}</p>
        <h1 id="error-title">{{ isNotFound ? 'This page is not here.' : 'We hit an unexpected problem.' }}</h1>
        <p>{{ isNotFound ? 'The address may be outdated, or the page may have moved.' : (props.error.statusMessage || 'Please try again or return to the platform home.') }}</p>
        <UButton size="lg" icon="i-lucide-arrow-left" @click="clearAndGoHome">
          Back to platform home
        </UButton>
      </section>
    </main>
  </UApp>
</template>
