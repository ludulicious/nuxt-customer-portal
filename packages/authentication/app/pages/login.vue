<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })
const { t } = useI18n()
const route = useRoute()
const redirectTo = computed(() => route.query.redirect?.toString() || '/dashboard')
useSeoMeta({ title: t('login.title'), description: t('login.title') })
</script>

<template>
  <div>
    <div class="mb-8 flex justify-center"><AppLogo class="h-8 w-auto shrink-0" /></div>
    <AuthenticationSignInForm :redirect-to="redirectTo" />
  </div>
</template>
