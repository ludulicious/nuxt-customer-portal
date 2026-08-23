<script setup lang="ts">
definePageMeta({ layout: 'portal' })
const { t } = useI18n()
useSeoMeta({ title: () => t('saasSettings.title') })
</script>

<template><PortalSettingsEditor /></template>
