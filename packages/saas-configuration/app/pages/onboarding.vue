<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
definePageMeta({ layout: 'centerform' })
const { t } = useI18n()
useSeoMeta({ title: () => t('saasSettings.onboardingTitle') })
</script>

<template><PortalSettingsEditor onboarding /></template>
